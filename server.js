import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyRuntimeSyncOrThrow } from './sync/runtime-sync-verifier.mjs';
import { beginAuthoritativeDrawPhase, ensureAuthoritativeDrawReview, resolveAuthoritativeDrawReview } from './runtime/pvp/draw-review-runtime.mjs';

const PORT = Number(process.env.PORT || 3000);
const BASE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(BASE, 'public');
const VERSION = 'Grandis Legacy PvP v2.5.16 — Local AI v5.33 shared gameplay/UI + lobby deck privacy + authorized observer hand view + embedded Deck Builder v1.14 + One Source v1.4 + Runtime Data v0.12.5 + Effect Recipe v0.11.5 + Checkpoint v0.11.4 + Foundation v1.73 + Core v0.41 + Sync v2.23';
const MAX_ROOM_LOGS = 120;
const MAX_SPECTATORS = 50;
const OBSERVER_PASSWORD = String(process.env.GL_OBSERVER_PASSWORD || 'GLObserver');
const LOBBY_NO_DECK_TIMEOUT_MS = Math.max(1000, Number(process.env.PVP_LOBBY_NO_DECK_TIMEOUT_MS || 3 * 60 * 1000));
const LOBBY_WITH_DECK_TIMEOUT_MS = Math.max(1000, Number(process.env.PVP_LOBBY_WITH_DECK_TIMEOUT_MS || 5 * 60 * 1000));
const MATCH_DISCONNECT_TIMEOUT_MS = Math.max(1000, Number(process.env.PVP_MATCH_DISCONNECT_TIMEOUT_MS || 5 * 60 * 1000));
const DISCONNECT_SWEEP_MS = Math.max(250, Number(process.env.PVP_DISCONNECT_SWEEP_MS || 5000));
const RUNTIME_SYNC_STATUS = verifyRuntimeSyncOrThrow(BASE);
const ACTIVE_CARD_DATA_FILE = join(BASE, 'data/season1/cards.runtime.v0.12.5.json');
const ACTIVE_EFFECT_DATA_FILE = join(BASE, 'data/season1/effect-recipes.runtime.v0.11.5.json');
const ACTIVE_SOURCE_CONFIG_FILE = join(BASE, 'data/config/active-runtime-source-stack.v1.73.json');

function loadActiveRuntimeSources() {
  const cards = JSON.parse(readFileSync(ACTIVE_CARD_DATA_FILE, 'utf8'));
  const effects = JSON.parse(readFileSync(ACTIVE_EFFECT_DATA_FILE, 'utf8'));
  const config = JSON.parse(readFileSync(ACTIVE_SOURCE_CONFIG_FILE, 'utf8'));
  const cardCount = Array.isArray(cards.cards)
    ? cards.cards.length
    : Object.values(cards.families || {}).reduce((sum, family) => sum + ((family && family.cards) || []).length, 0);
  const effectCount = Array.isArray(effects.effect_recipes) ? effects.effect_recipes.length : 0;
  const canonicalHash = '5812e107dbe82cef660975e091388eae1ad5a852c7be066c7443a5a321188bab';
  if (cards.schema_version !== '1.4.0' || cards.canonical_registry_hash !== canonicalHash) throw new Error(`Active cards source mismatch: ${cards.schema_version || 'missing'}`);
  if (cardCount !== 198) throw new Error(`Active card count mismatch: ${cardCount}`);
  if (effects.schema_version !== '1.4.0' || effects.canonical_registry_hash !== canonicalHash) throw new Error(`Active effects source mismatch: ${effects.schema_version || 'missing'}`);
  if (effectCount !== 198) throw new Error(`Active effect recipe count mismatch: ${effectCount}`);
  return { cards, effects, config, cardCount, effectCount };
}

const ACTIVE_RUNTIME_SOURCES = loadActiveRuntimeSources();
const ACTIVE_CARDS_BY_ID = (() => {
  const out = {};
  const cards = ACTIVE_RUNTIME_SOURCES.cards;
  if (Array.isArray(cards.cards)) for (const card of cards.cards) if (card && card.card_id) out[card.card_id] = card;
  for (const family of Object.values(cards.families || {})) for (const card of (family && family.cards) || []) if (card && card.card_id) out[card.card_id] = card;
  return out;
})();
const RUNTIME_CODE = readFileSync(join(ROOT, 'js/static-data.js'), 'utf8') + '\n' + readFileSync(join(ROOT, 'js/runtime-authority.js'), 'utf8') + '\n' + readFileSync(join(ROOT, 'js/app.bundle.js'), 'utf8');
const STARTER_PRESET_FILE = join(ROOT, 'starter_deck_examples/Grandis_Legacy_Starter_Deck_Presets_v1.2_LocalAI_PvP.json');
const STARTER_DECK_OPTIONS = (() => {
  try {
    const parsed = JSON.parse(readFileSync(STARTER_PRESET_FILE, 'utf8'));
    return (parsed.starters || parsed.decks || []).map((d) => ({ key: safeDeckKey(d.preset_id), label: safeText(d.display_name || d.deck_name || d.preset_id, 100) })).filter((d) => d.key && d.label);
  } catch {
    return [
      { key: 'starter_01_elemental_lord_conqueror_saint', label: 'Starter 01 — Elemental Lord / Conqueror / Saint' },
      { key: 'starter_02_crusader_conqueror_saint', label: 'Starter 02 — Crusader / Conqueror / Saint' }
    ];
  }
})();
const STARTER_DECK_MAP = new Map(STARTER_DECK_OPTIONS.map((d) => [d.key, d]));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

const rooms = new Map();
const clone = (x) => JSON.parse(JSON.stringify(x));
const HIDDEN_CARD_BACK = '__HIDDEN_CARD_BACK__';
function newSeatToken() { return randomBytes(24).toString('base64url'); }
function tokenHash(token) { return token ? createHash('sha256').update(String(token)).digest('hex') : ''; }
function tokenMatches(client, token) { return Boolean(client && token && client.seatTokenHash && client.seatTokenHash === tokenHash(token)); }
function observerPasswordMatches(value) {
  const supplied = Buffer.from(String(value || ''), 'utf8');
  const expected = Buffer.from(OBSERVER_PASSWORD, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function hiddenCards(count) { return Array(Math.max(0, Number(count || 0))).fill(HIDDEN_CARD_BACK); }

function safeText(value, max = 120) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function safeRoom(value) {
  const raw = safeText(value || '', 48).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return raw || 'LOBBY';
}
function safeClient(value) {
  const raw = safeText(value || '', 80).replace(/[^A-Za-z0-9_-]/g, '');
  return raw || '';
}
function safeDeckKey(value) {
  return safeText(value || '', 100).replace(/[^A-Za-z0-9_-]/g, '');
}
function deckOption(key) {
  return STARTER_DECK_MAP.get(safeDeckKey(key)) || null;
}
function safeCustomDeck(value) {
  if (!value || typeof value !== 'object') return null;
  const json = JSON.stringify(value);
  if (json.length > 600000) throw new Error('Custom deck JSON is too large.');
  const deck = JSON.parse(json);
  const name = safeText(deck.display_name || deck.deck_name || 'Imported Custom Deck', 100) || 'Imported Custom Deck';
  return { deck, name };
}
function nowIso() { return new Date().toISOString(); }
function sideForSeat(seat) { return Number(seat) === 2 ? 'AI' : 'PLAYER'; }
function publicSeatLabel(seat) { return Number(seat) === 2 ? 'Player 2' : 'Player 1'; }
function publicSideName(side) { return side === 'AI' ? 'Player 2' : 'Player 1'; }
function humanizeRuntimeText(text) { return String(text || '').replace(/\bAI\b/g, 'Player 2').replace(/\bPLAYER\b/g, 'Player 1'); }
function sideStateArray(state, side, zone) {
  if (!state) return [];
  const key = side === 'AI'
    ? ({ hand: 'aiHand', discard: 'aiDiscard', deck: 'aiDeck', legacy: 'aiLegacy' })[zone]
    : ({ hand: 'playerHand', discard: 'playerDiscard', deck: 'playerDeck', legacy: 'playerLegacy' })[zone];
  return key && Array.isArray(state[key]) ? state[key] : [];
}
function multisetAdded(before, after) {
  const counts = new Map();
  for (const id of before || []) counts.set(id, (counts.get(id) || 0) + 1);
  const out = [];
  for (const id of after || []) {
    const left = counts.get(id) || 0;
    if (left > 0) counts.set(id, left - 1); else out.push(id);
  }
  return out;
}
function multisetRemoved(before, after) { return multisetAdded(after || [], before || []); }
function sideHeroesState(state, side) { return (side === 'AI' ? state?.aiHeroes : state?.playerHeroes) || {}; }
function cardPublicFamily(cardId) {
  const c = ACTIVE_CARDS_BY_ID[cardId] || {};
  return String(c.family || c.classification || c.card_category || c.type || 'Card');
}
function cardPublicRank(cardId) {
  const c = ACTIVE_CARDS_BY_ID[cardId] || {};
  const raw = String(c.identity?.rank || c.class_rank || '');
  if (/III|3/i.test(raw)) return 3;
  if (/II|2/i.test(raw)) return 2;
  if (/I|1/i.test(raw)) return 1;
  return 0;
}
function responseOptionContext(beforeState, actorSide, intent) {
  if (intent !== 'confirmSelectedResponse') return null;
  const rw = beforeState && beforeState.responseWindow;
  if (!rw || rw.response_owner !== actorSide || !Array.isArray(rw.options)) return null;
  const idx = Number(rw.selected);
  const opt = Number.isInteger(idx) && idx >= 0 ? rw.options[idx] : null;
  if (!opt || !opt.card_id) return null;
  return {
    card_id: opt.card_id,
    hand_index: opt.hand_index,
    source_side: actorSide,
    source_lane: opt.source_lane || rw.target_lane || null,
    target_side: rw.target_side || actorSide,
    target_lane: rw.target_lane || null,
    response_card: true
  };
}
function publicActionContext(beforeState, afterState, actorSide, intent) {
  const responseCtx = responseOptionContext(beforeState, actorSide, intent);
  if (responseCtx) return responseCtx;
  const candidates = [
    afterState?.responseWindow?.action,
    afterState?.responseWindow,
    beforeState?.pending,
    afterState?.pending
  ];
  for (const raw of candidates) {
    if (!raw || !raw.card_id) continue;
    const sourceSide = raw.source_side || raw.side || actorSide;
    if (sourceSide !== actorSide) continue;
    return {
      card_id: raw.card_id,
      hand_index: raw.hand_index,
      source_side: actorSide,
      source_lane: raw.source_lane || null,
      target_side: raw.target_side || afterState?.responseWindow?.target_side || null,
      target_lane: raw.target_lane || afterState?.responseWindow?.target_lane || null,
      target_lanes: Array.isArray(raw.target_lanes) ? raw.target_lanes.slice() : null,
      triple_shot_area: !!raw.triple_shot_area
    };
  }
  return null;
}
function newlyAddedAttachment(beforeState, afterState, side, cardId) {
  const beforeIds = new Set((beforeState?.activeAttachments || []).map((a) => a && (a.attachment_id || `${a.side}:${a.lane}:${a.slot}:${a.card_id}`)).filter(Boolean));
  return (afterState?.activeAttachments || []).find((a) => {
    if (!a || a.side !== side || (cardId && a.card_id !== cardId)) return false;
    const id = a.attachment_id || `${a.side}:${a.lane}:${a.slot}:${a.card_id}`;
    return !beforeIds.has(id);
  }) || null;
}
function buildPublicAnimationEvents(beforeState, afterState, actorSide, intent, revision) {
  if (!beforeState || !afterState) return [];
  const events = [];
  const add = (event) => {
    if (!event) return;
    event.revision = revision;
    event.id = event.id || `anim-${revision}-${events.length + 1}-${safeText(event.kind || intent, 40)}-${safeText(event.card_id || event.to_card_id || event.lane || '', 40)}`;
    events.push(event);
  };
  const handBefore = sideStateArray(beforeState, actorSide, 'hand');
  const handAfter = sideStateArray(afterState, actorSide, 'hand');
  const removed = multisetRemoved(handBefore, handAfter);
  const discardAdded = multisetAdded(sideStateArray(beforeState, actorSide, 'discard'), sideStateArray(afterState, actorSide, 'discard'));
  const ctx = publicActionContext(beforeState, afterState, actorSide, intent);
  const responseCardId = afterState.responseWindow && afterState.responseWindow.source_side === actorSide
    ? (afterState.responseWindow.action && afterState.responseWindow.action.card_id) || afterState.responseWindow.card_id
    : null;
  let cardId = (ctx && ctx.card_id) || responseCardId || null;
  let attachment = newlyAddedAttachment(beforeState, afterState, actorSide, cardId);
  if (!cardId && attachment) cardId = attachment.card_id;
  if (!cardId && discardAdded.length === 1) cardId = discardAdded[0];
  const cardBecamePublic = Boolean(cardId && (
    removed.includes(cardId) || discardAdded.includes(cardId) || attachment || responseCardId === cardId
  ));
  const tributePending = beforeState.pending && beforeState.pending.type === 'tribute_target' && beforeState.pending.card_id === cardId;
  let tributeTargetLane = null;
  if (tributePending) {
    for (const lane of ['LEFT','CENTER','RIGHT']) {
      const a = sideHeroesState(beforeState, actorSide)[lane] || {};
      const b = sideHeroesState(afterState, actorSide)[lane] || {};
      if ((a.card_id && b.card_id && a.card_id !== b.card_id) || Number(a.exp_total || 0) !== Number(b.exp_total || 0) || (a.exp_cards || []).length !== (b.exp_cards || []).length) { tributeTargetLane = lane; break; }
    }
  }
  if (cardId && cardBecamePublic && !['confirmDrawReplacement','commitDrawReplacementChoice'].includes(intent)) {
    if (!attachment) attachment = newlyAddedAttachment(beforeState, afterState, actorSide, cardId);
    const action = ctx || {};
    const targetLane = tributePending ? tributeTargetLane || beforeState.pending.target_lane || action.target_lane || null : action.target_lane || afterState.responseWindow?.target_lane || null;
    add({
      kind: tributePending ? 'tribute' : 'card_play',
      card_id: cardId,
      family: cardPublicFamily(cardId),
      actor_side: actorSide,
      hand_index: Number.isInteger(Number(action.hand_index)) ? Number(action.hand_index) : Math.max(0, handBefore.lastIndexOf(cardId)),
      source_side: actorSide,
      source_lane: action.source_lane || afterState.responseWindow?.source_lane || null,
      target_side: tributePending ? actorSide : action.target_side || afterState.responseWindow?.target_side || null,
      target_lane: targetLane,
      target_lanes: Array.isArray(action.target_lanes) ? action.target_lanes.slice() : null,
      triple_shot_area: !!action.triple_shot_area,
      destination: tributePending ? { type: 'hero', side: actorSide, lane: targetLane }
        : attachment ? { type: 'attachment', side: attachment.side, lane: attachment.lane, slot: Number(attachment.slot || 0) }
        : (discardAdded.includes(cardId) ? { type: 'discard', side: actorSide } : { type: 'target' })
    });
  }

  for (const side of ['PLAYER','AI']) {
    const beforeHeroes = sideHeroesState(beforeState, side);
    const afterHeroes = sideHeroesState(afterState, side);
    for (const lane of ['LEFT','CENTER','RIGHT']) {
      const beforeHero = beforeHeroes[lane] || {};
      const afterHero = afterHeroes[lane] || {};
      const beforeId = beforeHero.card_id || null;
      const afterId = afterHero.card_id || null;
      if (beforeId && afterId && beforeId !== afterId && cardPublicRank(afterId) > cardPublicRank(beforeId)) {
        add({
          kind: 'rank_up', actor_side: side, lane,
          from_card_id: beforeId, to_card_id: afterId,
          exp_card_ids: (() => { const ids = Array.isArray(beforeHero.exp_cards) ? beforeHero.exp_cards.slice() : []; if (tributePending && tributeTargetLane === lane && cardId && !ids.includes(cardId)) ids.push(cardId); return ids; })()
        });
      }
      const beforeLegacy = beforeHero.active_legacy_card_id || null;
      const afterLegacy = afterHero.active_legacy_card_id || null;
      if (!beforeLegacy && afterLegacy) add({ kind: 'legacy_to_field', actor_side: side, lane, card_id: afterLegacy });
    }
  }

  for (const side of ['PLAYER','AI']) {
    const drawBefore = Number(beforeState.cardsDrawnThisTurn && beforeState.cardsDrawnThisTurn[side] || 0);
    const drawAfter = Number(afterState.cardsDrawnThisTurn && afterState.cardsDrawnThisTurn[side] || 0);
    if (drawAfter > drawBefore) {
      const count = Math.max(1, drawAfter - drawBefore);
      const fallback = afterState.lastDrawnCardBySide && afterState.lastDrawnCardBySide[side] || null;
      const added = multisetAdded(sideStateArray(beforeState, side, 'hand'), sideStateArray(afterState, side, 'hand'));
      const cardIds = added.slice(-count);
      while (cardIds.length < count) cardIds.unshift(fallback);
      add({ kind: 'draw', actor_side: side, count, card_ids: cardIds, card_id: cardIds[cardIds.length - 1] || fallback });
    }
  }
  return events;
}
function buildPublicAnimationEvent(beforeState, afterState, actorSide, intent, revision) {
  return buildPublicAnimationEvents(beforeState, afterState, actorSide, intent, revision)[0] || null;
}
function normalizeServerBoard(board) {
  const st = board && board.appState;
  if (!st) return board;
  st.racial = Math.max(0, Math.min(2, Number(st.racial || 0)));
  st.aiRacial = Math.max(0, Math.min(2, Number(st.aiRacial || 0)));
  st.pvpHumanVsHuman = true;
  // Result-popup visibility is client-local. Never let the headless server render consume it.
  st.gameResultShown = false;
  return board;
}


function maskAppStateForSeat(appState, seat, revealBothHands = false) {
  if (!appState) return appState;
  const st = clone(appState);
  const recipientSeat = Number(seat || 0);
  const hidePlayerHand = !revealBothHands && recipientSeat !== 1;
  const hideAiHand = !revealBothHands && recipientSeat !== 2;
  const hidePlayerLegacy = recipientSeat !== 1;
  const hideAiLegacy = recipientSeat !== 2;

  function maskSide(prefix, hideHand, hideLegacy) {
    const handKey = prefix === 'player' ? 'playerHand' : 'aiHand';
    const deckKey = prefix === 'player' ? 'playerDeck' : 'aiDeck';
    const legacyKey = prefix === 'player' ? 'playerLegacy' : 'aiLegacy';
    const handCountKey = prefix === 'player' ? 'playerHandCount' : 'aiHandCount';
    const deckCountKey = prefix === 'player' ? 'playerDeckCount' : 'aiDeckCount';
    const legacyCountKey = prefix === 'player' ? 'playerLegacyCount' : 'aiLegacyCount';
    const handCount = Array.isArray(st[handKey]) ? st[handKey].length : Number(st[handCountKey] || 0);
    const deckCount = Array.isArray(st[deckKey]) ? st[deckKey].length : Number(st[deckCountKey] || 0);
    const legacyCount = Array.isArray(st[legacyKey]) ? st[legacyKey].length : Number(st[legacyCountKey] || 0);
    st[handCountKey] = handCount;
    st[deckCountKey] = deckCount;
    st[legacyCountKey] = legacyCount;
    // Deck order is private even to its owner in PvP snapshots; the server keeps canonical order.
    st[deckKey] = hiddenCards(deckCount);
    if (hideHand) st[handKey] = hiddenCards(handCount);
    if (hideLegacy) st[legacyKey] = hiddenCards(legacyCount);
  }

  maskSide('player', hidePlayerHand, hidePlayerLegacy);
  maskSide('ai', hideAiHand, hideAiLegacy);
  const localSide = recipientSeat === 1 ? 'PLAYER' : (recipientSeat === 2 ? 'AI' : null);
  if (st.lastDrawnCardBySide && typeof st.lastDrawnCardBySide === 'object') {
    for (const side of ['PLAYER','AI']) if (!localSide || side !== localSide) st.lastDrawnCardBySide[side] = HIDDEN_CARD_BACK;
  }
  if (Array.isArray(st.presentationEvents)) {
    st.presentationEvents = st.presentationEvents.map((event) => {
      const safe = clone(event);
      const side = safe.side || safe.actor_side;
      if (safe.type === 'CARD_DRAWN' && (!localSide || side !== localSide)) {
        safe.card_id = HIDDEN_CARD_BACK;
        if (Array.isArray(safe.card_ids)) safe.card_ids = hiddenCards(safe.card_ids.length);
      }
      return safe;
    });
  }
  if (!localSide) {
    st.pending = maskPendingForSpectator(st.pending);
    st.responseWindow = maskResponseWindow(st.responseWindow, null);
  } else {
    st.pending = maskPendingForSide(st.pending, localSide);
    st.responseWindow = maskResponseWindow(st.responseWindow, localSide);
  }
  if (Array.isArray(st.log)) st.log = st.log.slice(0, 20).map(humanizeRuntimeText);
  return st;
}
function pendingOwnerSide(pending) {
  if (!pending) return null;
  return pending.decision_side || pending.response_owner || pending.side || pending.source_side || null;
}
function maskPendingForSpectator(pending) {
  if (!pending) return pending;
  const safe = clone(pending);
  if (Array.isArray(safe.options)) safe.options = hiddenCards(safe.options.length);
  if (Array.isArray(safe.cards)) safe.cards = hiddenCards(safe.cards.length);
  if (Array.isArray(safe.choices)) safe.choices = hiddenCards(safe.choices.length);
  if (Array.isArray(safe.hand)) safe.hand = hiddenCards(safe.hand.length);
  if (safe.type === 'draw_replacement_choice') { safe.drawn_card_id = HIDDEN_CARD_BACK; delete safe.hand_index; delete safe.source_hero_card_id; }
  safe.private_masked = true;
  return safe;
}
function maskPendingForSide(pending, localSide) {
  if (!pending) return pending;
  const owner = pendingOwnerSide(pending);
  if (!owner || owner === localSide) return clone(pending);
  return maskPendingForSpectator(pending);
}
function maskResponseWindow(responseWindow, localSide) {
  if (!responseWindow) return responseWindow;
  const safe = clone(responseWindow);
  if (localSide && safe.response_owner === localSide) return safe;
  if (Array.isArray(safe.options)) safe.options = hiddenCards(safe.options.length);
  safe.private_masked = true;
  return safe;
}
function maskCanonicalBoardForRecipient(board, client) {
  if (!board) return board;
  const masked = clone(board);
  const revealBothHands = Boolean(client && client.role === 'spectator' && client.observerAuthorized);
  masked.appState = maskAppStateForSeat(masked.appState, client && client.role === 'player' ? client.seat : null, revealBothHands);
  masked.pvpPrivateStateMasked = true;
  masked.pvpRecipientSeat = client && client.role === 'player' ? client.seat : null;
  masked.pvpObserverBothHands = revealBothHands;
  return masked;
}

function animationEventsForRecipient(events, client) {
  const list = Array.isArray(events) ? clone(events) : [];
  const localSide = client && client.role === 'player' ? sideForSeat(client.seat) : null;
  return list.map((event) => {
    if (!event || event.kind !== 'draw' || (localSide && event.actor_side === localSide)) return event;
    const count = Math.max(1, Number(event.count || (event.card_ids && event.card_ids.length) || 1));
    event.card_ids = hiddenCards(count);
    event.card_id = HIDDEN_CARD_BACK;
    return event;
  });
}

function sideNameForSeat(room, seat) {
  const client = [...room.players.values()].find((c) => c.seat === Number(seat));
  return client?.name || publicSeatLabel(seat);
}
function makePvpResult(room, winnerSeat, loserSeat, reason) {
  const st = room.engine?.board?.appState || {};
  const winnerName = sideNameForSeat(room, winnerSeat);
  const loserName = sideNameForSeat(room, loserSeat);
  return {
    winnerSeat: Number(winnerSeat),
    loserSeat: Number(loserSeat),
    winnerName,
    loserName,
    reason: safeText(reason || `${loserName} surrendered the match.`, 220),
    round: Number(st.round || 1),
    phase: safeText(st.phase || 'Unknown', 60),
    endedAt: nowIso()
  };
}
function applyServerSurrender(room, client) {
  if (client?.role !== 'player' || !client.seat) throw new Error('Only active players can surrender.');
  if (!room.engine?.board?.appState) throw new Error('No active server board to surrender.');
  if (room.match.status !== 'started' && room.match.status !== 'coin-flip' && room.match.status !== 'coin-result') throw new Error('No active match to surrender.');
  const loserSeat = Number(client.seat);
  const winnerSeat = loserSeat === 1 ? 2 : 1;
  const result = makePvpResult(room, winnerSeat, loserSeat, `${client.name || publicSeatLabel(loserSeat)} surrendered the match.`);
  const st = room.engine.board.appState;
  st.gameOver = true;
  st.winner = sideForSeat(winnerSeat);
  st.gameEndReason = result.reason;
  st.pending = null;
  st.responseWindow = null;
  st.gameResultShown = false;
  st.pvpHumanVsHuman = true;
  st.pvpGameResult = clone(result);
  st.log = Array.isArray(st.log) ? st.log.slice() : [];
  st.log.unshift(`GAME END: ${result.winnerName} wins. ${result.reason}`);
  if (st.log.length > 20) st.log.length = 20;
  room.engine.board = normalizeServerBoard(clone(room.engine.board));
  room.engine.revision += 1;
  room.match.status = 'finished';
  room.match.finishedAt = nowIso();
  room.match.result = result;
  room.match.serverBoard = room.engine.board;
  room.match.serverBoardRevision = room.engine.revision;
  room.match.lastIntent = { fromSeat: loserSeat, fromName: client.name, intent: 'surrender-match', at: nowIso() };
  addLog(room, `SERVER RUNTIME GAME END: ${result.winnerName} wins. ${result.reason}`);
  return result;
}

function buildOpeningCoinFlip(p1, p2, choiceInput) {
  // Old Discord PvP alpha rule reference: Player 2 calls Heads/Tails; winner takes the first turn.
  const choice = String(choiceInput || '').toUpperCase();
  if (!['HEADS', 'TAILS'].includes(choice)) throw new Error('Player 2 must choose Heads or Tails before the first Draw Phase.');
  const outcome = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
  const firstSeat = choice === outcome ? 2 : 1;
  const firstClient = firstSeat === 1 ? p1 : p2;
  return {
    rule: 'old-alpha-player-2-call',
    chooserSeat: 2,
    chooserLabel: 'Player 2',
    choice,
    outcome,
    firstSeat,
    firstSeatLabel: publicSeatLabel(firstSeat),
    firstPlayerName: firstClient?.name || publicSeatLabel(firstSeat),
    player1Name: p1?.name || 'Player 1',
    player2Name: p2?.name || 'Player 2',
    resolvedAt: nowIso()
  };
}
function openingCoinFlipLine(flip) {
  if (!flip) return '';
  return `OPENING COIN FLIP: ${flip.player2Name || 'Player 2'} calls ${flip.choice}. Result: ${flip.outcome}. ${flip.firstPlayerName || flip.firstSeatLabel} starts in Draw Phase.`;
}

function markOpeningCoinFlipPending(engine, p1, p2) {
  if (!engine?.board?.appState) return engine?.snapshot?.() || null;
  const st = engine.board.appState;
  st.turn = 'PLAYER';
  st.phase = 'Opening Coin Flip';
  st.round = 1;
  st.aiControl = null;
  st.pvpHumanVsHuman = true;
  st.pvpCoinFlipPending = true;
  st.pvpOpeningCoinFlip = {
    pending: true,
    chooserSeat: 2,
    chooserLabel: 'Player 2',
    player1Name: p1?.name || 'Player 1',
    player2Name: p2?.name || 'Player 2',
    createdAt: nowIso()
  };
  st.pvpPlayerNames = { PLAYER: p1?.name || 'Player 1', AI: p2?.name || 'Player 2' };
  st.log = Array.isArray(st.log) ? st.log.slice() : [];
  st.log = st.log.filter((line) => !/PLAYER begins in Draw Phase/i.test(String(line || '')));
  st.log.unshift('OPENING COIN FLIP: Battlefield loaded. Player 2 must choose Heads or Tails before Round 1 Draw Phase begins.');
  if (st.log.length > 20) st.log.length = 20;
  engine.board = clone(engine.board);
  engine.revision += 1;
  return engine.snapshot();
}

function markOpeningCoinFlipResultPending(engine, flip, p1, p2) {
  if (!engine?.board?.appState || !flip) return engine?.snapshot?.() || null;
  const st = engine.board.appState;
  st.turn = 'PLAYER';
  st.phase = 'Opening Coin Flip Result';
  st.round = 1;
  st.aiControl = null;
  st.pvpHumanVsHuman = true;
  st.pvpCoinFlipPending = false;
  st.pvpCoinFlipResultPending = true;
  st.pvpOpeningCoinFlip = clone(flip);
  st.pvpFirstSeat = flip.firstSeat;
  st.pvpFirstSeatLabel = flip.firstSeatLabel;
  st.pvpPlayerNames = { PLAYER: p1?.name || 'Player 1', AI: p2?.name || 'Player 2' };
  st.log = Array.isArray(st.log) ? st.log.slice() : [];
  st.log = st.log.filter((line) => !/PLAYER begins in Draw Phase/i.test(String(line || '')));
  st.log.unshift(`${openingCoinFlipLine(flip)} Confirm the result to start Round 1 Draw Phase.`);
  if (st.log.length > 20) st.log.length = 20;
  engine.board = clone(engine.board);
  engine.revision += 1;
  return engine.snapshot();
}
function applyOpeningCoinFlipToEngine(engine, flip, p1, p2) {
  if (!engine?.board?.appState || !flip) return engine?.snapshot?.() || null;
  const firstSide = sideForSeat(flip.firstSeat);
  const opening = engine.completeOpeningFlow(firstSide, flip);
  const st = engine.board.appState;
  st.aiControl = null;
  st.pvpHumanVsHuman = true;
  st.pvpCoinFlipPending = false;
  st.pvpCoinFlipResultPending = false;
  st.pvpOpeningCoinFlip = clone(flip);
  st.pvpFirstSeat = flip.firstSeat;
  st.pvpFirstSeatLabel = flip.firstSeatLabel;
  st.pvpPlayerNames = { PLAYER: p1?.name || 'Player 1', AI: p2?.name || 'Player 2' };
  st.log = Array.isArray(st.log) ? st.log.slice() : [];
  st.log = st.log.filter((line) => !/PLAYER begins in Draw Phase/i.test(String(line || '')));
  st.log.unshift(openingCoinFlipLine(flip));
  st.log.unshift(`${flip.firstPlayerName || flip.firstSeatLabel || 'First player'}: click Your Turn to resolve Round 1 Draw Phase.`);
  if (st.log.length > 20) st.log.length = 20;
  engine.board.appState = st;
  engine.board = clone(engine.board);
  return engine.snapshot(opening?.animationEvents || []);
}
function normalizeArgs(args) { return Array.isArray(args) ? args.slice(0, 8) : []; }

function makeDomStub() {
  const dummy = {
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
    querySelectorAll() { return []; }, querySelector() { return null; }, closest() { return null; },
    focus() {}, scrollIntoView() {}, click() {},
    get innerHTML() { return this._html || ''; }, set innerHTML(v) { this._html = String(v ?? ''); },
    get textContent() { return this._txt || ''; }, set textContent(v) { this._txt = String(v ?? ''); },
    disabled: false, value: '', checked: false
  };
  const doc = {
    readyState: 'loading',
    addEventListener() {}, removeEventListener() {},
    getElementById() { return dummy; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { ...dummy, style: {}, classList: dummy.classList }; },
    body: dummy
  };
  return { doc, dummy };
}

function createRuntimeEngine() {
  const { doc } = makeDomStub();
  const win = {
    document: doc,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    setTimeout, clearTimeout, console,
    GL_PVP_SHARED_BOARD_ACTIVE: true,
    GL_APP_MODE: 'PVP'
  };
  const ctx = {
    window: win, document: doc, console, setTimeout, clearTimeout, URL,
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: {}, location: { href: 'http://localhost/' }
  };
  ctx.globalThis = ctx;
  win.window = win;
  win.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(RUNTIME_CODE, ctx, { timeout: 2000, filename: 'local-ai-runtime-vm.js' });
  const bridge = ctx.window.GL_LOCAL_AI_BRIDGE;
  if (!bridge || typeof bridge.startSharedMatch !== 'function' || typeof bridge.applyServerIntent !== 'function') {
    throw new Error('Runtime bridge did not initialize.');
  }
  const browserCards = ctx.window.GL_CARD_DEFINITIONS;
  const browserEffects = ctx.window.GL_EFFECT_RECIPES;
  const browserCardCount = browserCards && Array.isArray(browserCards.cards)
    ? browserCards.cards.length
    : Object.values((browserCards && browserCards.families) || {}).reduce((sum, family) => sum + ((family && family.cards) || []).length, 0);
  const browserEffectCount = browserEffects && Array.isArray(browserEffects.effect_recipes) ? browserEffects.effect_recipes.length : 0;
  if (!browserCards || browserCards.version !== 'v0.12.5' || browserCards.canonical_registry_hash !== '5812e107dbe82cef660975e091388eae1ad5a852c7be066c7443a5a321188bab' || browserCardCount !== 198) {
    throw new Error(`Browser runtime card source guard failed: ${browserCards && browserCards.version} / ${browserCardCount}`);
  }
  if (!browserEffects || browserEffects.version !== 'v0.11.5' || browserEffects.canonical_registry_hash !== '5812e107dbe82cef660975e091388eae1ad5a852c7be066c7443a5a321188bab' || browserEffectCount !== 198) {
    throw new Error(`Browser runtime effect source guard failed: ${browserEffects && browserEffects.version} / ${browserEffectCount}`);
  }
  bridge.setSharedBoardMode(true);
  return {
    revision: 0,
    board: null,
    start(options = {}) {
      this.board = bridge.startSharedMatch(options);
      this.revision = 1;
      return this.snapshot();
    },
    completeOpeningFlow(firstSide, flipData) {
      if (!this.board) throw new Error('Server runtime has no active board.');
      bridge.importCanonicalSnapshot(this.board, 1, { notice: '', skipImportAnimations: true });
      const result = bridge.completeOpeningFlow(firstSide, flipData || {}, { holdAtDraw: true, bridgeImmediate: false });
      this.board = normalizeServerBoard(clone(result && result.snapshot ? result.snapshot : bridge.getSnapshot()));
      this.revision += 1;
      return this.snapshot(result && result.events ? result.events : []);
    },
    snapshot(animationEvents = []) { const list = Array.isArray(animationEvents) ? animationEvents : (animationEvents ? [animationEvents] : []); return { board: normalizeServerBoard(clone(this.board)), revision: this.revision, animationEvents: list, animationEvent: list[0] || null }; },
    viewForSeat(seat) {
      if (!this.board) return null;
      this.board = normalizeServerBoard(this.board);
      bridge.importCanonicalSnapshot(this.board, 1, { notice: '' });
      const view = normalizeServerBoard(clone(this.board));
      if (view && view.appState && bridge.getActivatedLegacyAbilitiesFor) {
        const localSide = sideForSeat(seat);
        view.appState.pvpLocalLegalLegacyAbilities = {};
        for (const lane of ['LEFT','CENTER','RIGHT']) view.appState.pvpLocalLegalLegacyAbilities[lane] = bridge.getActivatedLegacyAbilitiesFor(localSide, lane) || [];
      }
      return view;
    },
    canSeatAct(seat) {
      if (!this.board?.appState) return false;
      const state = this.board.appState;
      const side = sideForSeat(seat);
      if (state.gameOver) return false;
      if (state.turn === side) return true;
      if (state.responseWindow && state.responseWindow.response_owner === side) return true;
      if (state.pending) {
        const decisionSide = state.pending.decision_side || state.pending.side || state.pending.source_side;
        if (decisionSide === side) return true;
        if (state.pending.type === 'response_window' && state.responseWindow?.response_owner === side) return true;
      }
      return false;
    },
    applyIntent(seat, intent, args) {
      if (!this.board) throw new Error('Server runtime has no active board.');
      const name = safeText(intent, 80);
      const passiveAllowed = new Set(['getSnapshot']);
      if (!passiveAllowed.has(name) && !this.canSeatAct(seat)) {
        throw new Error('Server authority rejected intent: it is not your legal turn/window.');
      }
      const canonicalSide = sideForSeat(seat);
      const beforeState = clone(this.board.appState || {});
      if (name === 'advancePhase' && beforeState.pvpTurnReady) throw new Error('Acknowledge Your Turn before Draw Phase resolves.');
      const before = JSON.stringify(beforeState);

      // Draw Review is no longer delegated to the browser bundle. The Node runtime resolves it directly.
      if (name === 'confirmDrawReplacement' || name === 'commitDrawReplacementChoice') {
        const rawChoice = name === 'commitDrawReplacementChoice'
          ? (normalizeArgs(args)[0] ? 'redraw' : 'keep')
          : String(normalizeArgs(args)[0] || '');
        const resolved = resolveAuthoritativeDrawReview(this.board.appState, canonicalSide, rawChoice, ACTIVE_CARDS_BY_ID, { mutate: false });
        this.board.appState = resolved.state;
        this.board.appState.pvpTurnReady = false;
        this.board = normalizeServerBoard(clone(this.board));
        this.revision += 1;
        const animationEvents = buildPublicAnimationEvents(beforeState, this.board.appState, canonicalSide, name, this.revision);
        return this.snapshot(animationEvents);
      }

      bridge.importCanonicalSnapshot(this.board, seat, { notice: '' });
      const result = bridge.applyServerIntent(name, normalizeArgs(args));
      if (!result?.ok) throw new Error(result?.error || 'Runtime rejected intent.');
      const next = bridge.getCanonicalSnapshot(seat);
      this.board = normalizeServerBoard(clone(next));

      // Local AI v5.16 remains the Draw Review behavior reference during normal turn flow. The server-side
      // repair is restricted to an actual Draw Phase only; it must never reopen Quick Reload from
      // Deploy after the player already chose Keep or Redraw.
      const current = this.board.appState;
      if (current && !current.pending && current.phase === 'Draw' && !current.pvpTurnReady) {
        const repaired = ensureAuthoritativeDrawReview(current, current.turn, ACTIVE_CARDS_BY_ID, { mutate: true });
        if (repaired.opened) this.board.appState = repaired.state;
      }
      const after = JSON.stringify(this.board.appState || {});
      if (after !== before) this.revision += 1;
      const animationEvents = buildPublicAnimationEvents(beforeState, this.board.appState, canonicalSide, name, this.revision);
      return this.snapshot(animationEvents);
    }
  };
}


function clientHasLoadedDeck(client) {
  return Boolean(client && (client.deckKey || client.deckData));
}
function matchIsActive(room) {
  return ['coin-flip', 'coin-result', 'started'].includes(room?.match?.status);
}
function disconnectPolicy(room, client) {
  if (matchIsActive(room)) return { timeoutMs: MATCH_DISCONNECT_TIMEOUT_MS, action: 'auto-forfeit', reason: 'active match' };
  if (clientHasLoadedDeck(client)) return { timeoutMs: LOBBY_WITH_DECK_TIMEOUT_MS, action: 'release-seat', reason: 'deck loaded' };
  return { timeoutMs: LOBBY_NO_DECK_TIMEOUT_MS, action: 'release-seat', reason: 'no deck loaded' };
}
function startDisconnectReservation(room, client) {
  const policy = disconnectPolicy(room, client);
  const startedAt = Date.now();
  client.disconnectedAt = new Date(startedAt).toISOString();
  client.offlineTimeoutMs = policy.timeoutMs;
  client.offlineTimeoutAction = policy.action;
  client.offlineTimeoutReason = policy.reason;
  client.offlineExpiresAt = new Date(startedAt + policy.timeoutMs).toISOString();
  return policy;
}
function clearDisconnectReservation(client) {
  if (!client) return;
  client.disconnectedAt = null;
  client.offlineTimeoutMs = null;
  client.offlineTimeoutAction = null;
  client.offlineTimeoutReason = null;
  client.offlineExpiresAt = null;
}
function releaseTimedOutSeat(room, client, reason) {
  if (!client || client.role !== 'player') return false;
  const seat = client.seat;
  const name = client.name || publicSeatLabel(seat);
  client.ready = false;
  client.deckKey = null;
  client.deckName = null;
  client.deckData = null;
  client.deckSource = null;
  clearDisconnectReservation(client);
  room.players.delete(client.clientId);
  addLog(room, `${name} exceeded the reconnect limit (${reason}) and released Player ${seat}.`);
  return true;
}
function expireDisconnectedPlayers(room, now = Date.now()) {
  let changed = false;
  for (const client of [...room.players.values()]) {
    if (client.connected !== false || !client.offlineExpiresAt) continue;
    const expiresAt = Date.parse(client.offlineExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt > now) continue;
    if (matchIsActive(room)) {
      try {
        applyServerSurrender(room, client);
        addLog(room, `${client.name || publicSeatLabel(client.seat)} did not reconnect within 5 minutes and automatically forfeited.`);
      } catch (err) {
        addLog(room, `Reconnect timeout for ${client.name || publicSeatLabel(client.seat)}: ${safeText(err?.message || err, 180)}.`);
      }
      changed = releaseTimedOutSeat(room, client, '5-minute active-match limit') || changed;
    } else {
      const reason = clientHasLoadedDeck(client) ? '5-minute deck-loaded limit' : '3-minute no-deck limit';
      changed = releaseTimedOutSeat(room, client, reason) || changed;
    }
  }
  return changed;
}

function addLog(room, message) {
  room.logs.push({ at: nowIso(), message: safeText(message, 300) });
  if (room.logs.length > MAX_ROOM_LOGS) room.logs.splice(0, room.logs.length - MAX_ROOM_LOGS);
  room.updatedAt = nowIso();
}
function chooseSeat(room) {
  const used = new Set([...room.players.values()].map((client) => client.seat));
  return used.has(1) ? 2 : 1;
}
function createRoom(id) {
  return {
    id, createdAt: nowIso(), updatedAt: nowIso(),
    players: new Map(), spectators: new Map(), logs: [], engine: null,
    match: { status: 'setup', startedAt: null, finishedAt: null, hostSeat: 1, seed: null, serverBoard: null, serverBoardRevision: 0, lastIntent: null, mode: 'server-authoritative-human-vs-human' }
  };
}
function roomState(id) {
  const roomId = safeRoom(id);
  if (!rooms.has(roomId)) {
    const room = createRoom(roomId);
    rooms.set(roomId, room);
    addLog(room, `Room ${roomId} created.`);
  }
  return rooms.get(roomId);
}
function publicClient(client, recipient, matchStatus = 'setup') {
  const expiresAt = client.offlineExpiresAt || null;
  const remainingMs = expiresAt ? Math.max(0, Date.parse(expiresAt) - Date.now()) : null;
  const hasDeck = clientHasLoadedDeck(client);
  const sameClient = Boolean(recipient && recipient.clientId === client.clientId);
  const revealDeckIdentity = matchStatus !== 'setup' || sameClient;
  return {
    clientId: client.clientId,
    name: client.name,
    role: client.role,
    seat: client.seat || null,
    seatLabel: client.seat ? publicSeatLabel(client.seat) : null,
    ready: !!client.ready,
    connected: client.connected !== false,
    observerAuthorized: Boolean(client.role === 'spectator' && client.observerAuthorized),
    hasDeck,
    deckKey: revealDeckIdentity ? (client.deckKey || null) : null,
    deckName: revealDeckIdentity ? (client.deckName || null) : null,
    deckSource: revealDeckIdentity ? (client.deckSource || (client.deckData ? 'custom' : (client.deckKey ? 'starter' : null))) : null,
    connectedAt: client.connectedAt || null,
    disconnectedAt: client.disconnectedAt || null,
    offlineExpiresAt: expiresAt,
    offlineRemainingMs: remainingMs,
    offlineTimeoutAction: client.offlineTimeoutAction || null,
    offlineTimeoutReason: client.offlineTimeoutReason || null
  };
}
function snapshotFor(room, client) {
  const match = { ...room.match };
  match.lastAnimationEvents = animationEventsForRecipient(room.match.lastAnimationEvents || [], client);
  match.lastAnimationEvent = match.lastAnimationEvents[0] || null;
  if (room.engine?.board) {
    const canonicalBoard = room.engine.viewForSeat(client?.seat || 1);
    match.serverBoard = maskCanonicalBoardForRecipient(canonicalBoard, client);
    match.serverBoardRevision = room.engine.revision;
    const state = match.serverBoard?.appState;
    if (state?.gameOver && room.match.status !== 'finished') {
      room.match.status = 'finished';
      room.match.finishedAt = nowIso();
      const winnerSeat = state.winner === 'AI' ? 2 : 1;
      const loserSeat = winnerSeat === 1 ? 2 : 1;
      room.match.result = state.pvpGameResult || makePvpResult(room, winnerSeat, loserSeat, humanizeRuntimeText(state.gameEndReason || 'Game ended.'));
      room.match.serverBoard = room.engine.board;
      room.match.serverBoardRevision = room.engine.revision;
      match.status = 'finished';
      match.finishedAt = room.match.finishedAt;
      match.result = room.match.result;
    }
  }
  return {
    type: 'snapshot', version: VERSION,
    room: { id: room.id, createdAt: room.createdAt, updatedAt: room.updatedAt },
    local: client ? { clientId: client.clientId, name: client.name, role: client.role, seat: client.seat || null, seatLabel: client.seat ? publicSeatLabel(client.seat) : null, seatToken: client.role === 'player' ? client.seatToken : null, ready: !!client.ready, observerAuthorized: Boolean(client.role === 'spectator' && client.observerAuthorized), deckKey: client.deckKey || null, deckName: client.deckName || null, deckSource: client.deckSource || (client.deckData ? 'custom' : (client.deckKey ? 'starter' : null)) } : null,
    players: [...room.players.values()].sort((a, b) => (a.seat || 99) - (b.seat || 99)).map((subject) => publicClient(subject, client, room.match.status)),
    spectators: [...room.spectators.values()].map((subject) => publicClient(subject, client, room.match.status)),
    match,
    deckOptions: STARTER_DECK_OPTIONS,
    logs: room.logs.slice(-MAX_ROOM_LOGS)
  };
}
function send(ws, payload) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); }
function broadcast(room) {
  for (const client of room.players.values()) send(client.ws, snapshotFor(room, client));
  for (const client of room.spectators.values()) send(client.ws, snapshotFor(room, client));
}
function reject(client, message) { send(client.ws, { type: 'notice', kind: 'error', message: safeText(message, 260) }); }
function safePath(pathname) {
  let p = decodeURIComponent(pathname || '/');
  if (p === '/' || p === '') p = '/index.html';
  p = normalize(p).replace(/^([.][.][/\\])+/, '');
  const full = join(ROOT, p);
  if (!full.startsWith(ROOT)) throw new Error('Bad path');
  return full;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({
        ok: true,
        version: VERSION,
        mode: 'server-authoritative-human-vs-human',
        rooms: rooms.size,
        deckOptions: STARTER_DECK_OPTIONS.length,
        activeSources: {
          cards: { version: 'v0.12.5', schema: ACTIVE_RUNTIME_SOURCES.cards.schema_version, count: ACTIVE_RUNTIME_SOURCES.cardCount, path: 'data/season1/cards.runtime.v0.12.5.json' },
          effects: { version: 'v0.11.5', schema: ACTIVE_RUNTIME_SOURCES.effects.schema_version, count: ACTIVE_RUNTIME_SOURCES.effectCount, path: 'data/season1/effect-recipes.runtime.v0.11.5.json' },
          foundation: 'v1.73',
          runtimeCore: 'v0.41',
          effectCheckpoint: 'v0.11.4',
          rankUp: 'v0.3',
          uiLock: 'v2.26',
          applicationRuntimeSync: RUNTIME_SYNC_STATUS.version,
          singleAuthorityVerified: RUNTIME_SYNC_STATUS.authorityVerified,
          legacyBridgeSynchronized: RUNTIME_SYNC_STATUS.legacyBridgeSynchronized,
          fullIntentOnlyMigrationComplete: RUNTIME_SYNC_STATUS.fullIntentOnlyMigrationComplete
        }
      }));
      return;
    }
    if (url.pathname === '/config.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(`window.GL_APP_MODE="PVP";window.GL_CONFIG=${JSON.stringify({ version: VERSION, wsPath: '/ws', mode: 'server-authoritative-human-vs-human' })};`);
      return;
    }
    const file = safePath(url.pathname);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const ext = extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream', 'cache-control': 'no-store, max-age=0', 'pragma': 'no-cache', 'expires': '0' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const room = roomState(url.searchParams.get('room'));
  const clientId = safeClient(url.searchParams.get('client'));
  const name = safeText(url.searchParams.get('name') || 'Player', 48) || 'Player';
  const initialDeck = deckOption(url.searchParams.get('deck'));
  const suppliedSeatToken = safeClient(url.searchParams.get('seatToken'));
  const wantsSpectator = ['1', 'true', 'yes', 'spectator', 'host'].includes(String(url.searchParams.get('spectate') || url.searchParams.get('role') || '').toLowerCase());
  if (!clientId) { send(ws, { type: 'fatal', message: 'Missing client identity.' }); ws.close(); return; }

  let client = room.players.get(clientId) || room.spectators.get(clientId) || null;
  let isNew = false;
  if (!client) {
    isNew = true;
    const offlinePlayer = !wantsSpectator ? [...room.players.values()].sort((a, b) => (a.seat || 99) - (b.seat || 99)).find((c) => c.connected === false && tokenMatches(c, suppliedSeatToken)) : null;
    if (offlinePlayer) {
      room.players.delete(offlinePlayer.clientId);
      client = { ...offlinePlayer, clientId, name: name || offlinePlayer.name, role: 'player', deckKey: room.match.status === 'setup' && initialDeck ? initialDeck.key : offlinePlayer.deckKey || null, deckName: room.match.status === 'setup' && initialDeck ? initialDeck.label : offlinePlayer.deckName || null, deckData: room.match.status === 'setup' && initialDeck ? null : offlinePlayer.deckData || null, deckSource: room.match.status === 'setup' && initialDeck ? 'starter' : offlinePlayer.deckSource || null, connectedAt: nowIso() };
      room.players.set(clientId, client);
      addLog(room, `${client.name} resumed Player ${client.seat} seat with seat token.`);
    } else if (wantsSpectator || room.players.size >= 2) {
      if (room.spectators.size >= MAX_SPECTATORS) { send(ws, { type: 'fatal', message: 'Spectator capacity reached.' }); ws.close(); return; }
      client = { clientId, name, role: 'spectator', observerAuthorized: false, ready: false, deckKey: null, deckName: null, deckData: null, deckSource: null, connectedAt: nowIso() };
      room.spectators.set(clientId, client);
    } else {
      const seatToken = newSeatToken();
      client = { clientId, name, role: 'player', seat: chooseSeat(room), seatToken, seatTokenHash: tokenHash(seatToken), ready: false, deckKey: initialDeck?.key || null, deckName: initialDeck?.label || null, deckData: null, deckSource: initialDeck ? 'starter' : null, connectedAt: nowIso() };
      room.players.set(clientId, client);
    }
  }
  if (client.ws && client.ws !== ws) client.ws.close(4000, 'Replaced by reconnect');
  Object.assign(client, { ws, clientId, name, connected: true });
  clearDisconnectReservation(client);
  if (client.role === 'player' && !client.seatToken) { client.seatToken = suppliedSeatToken || newSeatToken(); client.seatTokenHash = tokenHash(client.seatToken); }
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  if (client.role === 'spectator') room.spectators.set(clientId, client); else room.players.set(clientId, client);
  addLog(room, client.role === 'spectator' ? `${client.name} ${isNew ? 'joined' : 'reconnected'} as Spectator.` : `${client.name} ${isNew ? 'joined' : 'reconnected'} as Player ${client.seat}.`);
  broadcast(room);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    try {
      if (client.role === 'spectator' && !['ping', 'rename', 'switch-role', 'chat', 'authorize-observer'].includes(msg.type)) throw new Error('Spectator mode is read-only.');
      switch (msg.type) {
        case 'ping': send(ws, { type: 'pong', at: nowIso(), version: VERSION }); return;
        case 'rename': {
          const nextName = safeText(msg.name || client.name, 48) || client.name;
          const changed = nextName !== client.name;
          client.name = nextName;
          if (changed && room.match.status === 'setup') client.ready = false;
          addLog(room, `${client.role === 'spectator' ? 'Spectator' : publicSeatLabel(client.seat)} is now shown as ${client.name}.`);
          break;
        }
        case 'authorize-observer': {
          if (client.role !== 'spectator') throw new Error('Observer access is available only in Spectator mode.');
          if (!observerPasswordMatches(msg.password)) throw new Error('Invalid observer password.');
          if (!client.observerAuthorized) addLog(room, `${client.name} unlocked Authorized Observer hand view.`);
          client.observerAuthorized = true;
          break;
        }
        case 'switch-role': {
          if (room.match.status !== 'setup') throw new Error('Role switching is only available in setup lobby.');
          const next = String(msg.role || '').toLowerCase();
          if (next === 'spectator' || next === 'host') {
            if (client.role === 'spectator') break;
            room.players.delete(clientId); client.role = 'spectator'; client.observerAuthorized = false; delete client.seat; client.ready = false; room.spectators.set(clientId, client); addLog(room, `${client.name} switched to Spectator and released the player seat.`);
          } else if (next === 'player') {
            if (client.role === 'player') break;
            if (room.players.size >= 2) throw new Error('Both player seats are occupied.');
            room.spectators.delete(clientId); client.role = 'player'; client.observerAuthorized = false; client.seat = chooseSeat(room); client.seatToken = newSeatToken(); client.seatTokenHash = tokenHash(client.seatToken); client.ready = false; room.players.set(clientId, client); addLog(room, `${client.name} joined as Player ${client.seat}.`);
          } else throw new Error('Choose player or spectator role.');
          break;
        }
        case 'set-deck': {
          if (client.role !== 'player') throw new Error('Only players choose decks.');
          if (room.match.status !== 'setup') throw new Error('Deck selection is locked after match start.');
          if (msg.customDeck || msg.deck) {
            const custom = safeCustomDeck(msg.customDeck || msg.deck);
            if (!custom) throw new Error('Invalid custom deck JSON.');
            const changed = client.deckName !== custom.name || client.deckSource !== 'custom';
            client.deckKey = 'CUSTOM';
            client.deckName = safeText(msg.deckName || custom.name, 100) || custom.name;
            client.deckData = custom.deck;
            client.deckSource = 'custom';
            if (changed) client.ready = false;
            addLog(room, `${client.name} locked in a custom deck.`);
            break;
          }
          const selected = deckOption(msg.deckKey || msg.key || msg.deckKey);
          if (!selected) throw new Error('Choose a valid starter deck before ready.');
          const changed = client.deckKey !== selected.key || client.deckSource !== 'starter';
          client.deckKey = selected.key;
          client.deckName = selected.label;
          client.deckData = null;
          client.deckSource = 'starter';
          if (changed) client.ready = false;
          addLog(room, `${client.name} locked in a starter deck.`);
          break;
        }
        case 'ready': {
          if (client.role !== 'player') throw new Error('Only players can ready.');
          // v1.6: accept the default display name used by the lobby input.
          // If a player leaves the default as "Player", normalize it to the public seat label
          // instead of blocking Ready. This keeps setup simple on desktop and mobile.
          if (!client.name || client.name === 'Player') {
            client.name = publicSeatLabel(client.seat) || 'Player';
          }
          if (!client.deckKey) throw new Error('Choose your deck before ready.');
          client.ready = !!msg.ready;
          addLog(room, `${client.name} is ${client.ready ? 'READY' : 'NOT READY'}.`);
          break;
        }
        case 'start-match': {
          if (client.seat !== 1) throw new Error('Only Player 1 may start.');
          if (room.match.status !== 'setup') throw new Error('Match start is already in progress.');
          if (room.players.size !== 2) throw new Error('Two player seats are required.');
          const p1 = [...room.players.values()].find((c) => c.seat === 1);
          const p2 = [...room.players.values()].find((c) => c.seat === 2);
          if (!p1 || !p2) throw new Error('Player 1 and Player 2 seats are required.');
          if (![p1, p2].every((c) => c.connected !== false && c.ready)) throw new Error('Both players must be connected and READY.');
          if (![p1, p2].every((c) => c.deckKey)) throw new Error('Both players must choose decks before start.');
          const seed = safeText(msg.seed || Math.random().toString(36).slice(2), 32);
          room.engine = createRuntimeEngine();
          const startOptions = { player1Name: p1.name, player2Name: p2.name };
          if (p1.deckData) startOptions.playerDeck = p1.deckData; else startOptions.playerDeckKey = p1.deckKey;
          if (p2.deckData) startOptions.player2Deck = p2.deckData; else startOptions.player2DeckKey = p2.deckKey;
          room.engine.start(startOptions);
          const pendingSnap = markOpeningCoinFlipPending(room.engine, p1, p2);
          room.match = {
            status: 'coin-flip', startedAt: null, finishedAt: null, hostSeat: 1, seed,
            coinFlip: { pending: true, chooserSeat: 2, chooserLabel: 'Player 2', awaitingChoice: true },
            serverBoard: pendingSnap?.board || null, serverBoardRevision: pendingSnap?.revision || 0, lastIntent: null, mode: 'server-authoritative-human-vs-human',
            playerNames: { 1: p1.name, 2: p2.name },
            deckChoices: { 1: { deckKey: p1.deckKey, deckName: p1.deckName, deckSource: p1.deckSource }, 2: { deckKey: p2.deckKey, deckName: p2.deckName, deckSource: p2.deckSource } }
          };
          addLog(room, `MATCH START REQUESTED by ${client.name}. Battlefield loaded first; Player 2 must choose Heads or Tails in the battlefield popup. Winner starts in Round 1 Draw Phase.`);
          break;
        }
        case 'choose-coin-flip': {
          if (client.seat !== 2) throw new Error('Only Player 2 chooses Heads or Tails.');
          if (room.match.status !== 'coin-flip' || !room.match.coinFlip?.pending) throw new Error('No opening coin flip is waiting.');
          const p1 = [...room.players.values()].find((c) => c.seat === 1);
          const p2 = [...room.players.values()].find((c) => c.seat === 2);
          if (!p1 || !p2) throw new Error('Player 1 and Player 2 seats are required.');
          if (!room.engine?.board) {
            room.engine = createRuntimeEngine();
            const startOptions = { player1Name: p1.name, player2Name: p2.name };
            if (p1.deckData) startOptions.playerDeck = p1.deckData; else startOptions.playerDeckKey = p1.deckKey;
            if (p2.deckData) startOptions.player2Deck = p2.deckData; else startOptions.player2DeckKey = p2.deckKey;
            room.engine.start(startOptions);
          }
          const openingCoinFlip = buildOpeningCoinFlip(p1, p2, msg.choice);
          const snap = markOpeningCoinFlipResultPending(room.engine, openingCoinFlip, p1, p2);
          room.match = {
            ...room.match,
            status: 'coin-result',
            startedAt: null,
            finishedAt: null,
            openingCoinFlip,
            coinFlip: {
              pending: false,
              awaitingConfirmation: true,
              choice: openingCoinFlip.choice,
              outcome: openingCoinFlip.outcome,
              firstSeat: openingCoinFlip.firstSeat,
              firstSeatLabel: openingCoinFlip.firstSeatLabel,
              firstPlayerName: openingCoinFlip.firstPlayerName
            },
            firstSeat: openingCoinFlip.firstSeat,
            firstPlayerName: openingCoinFlip.firstPlayerName,
            serverBoard: snap.board,
            serverBoardRevision: snap.revision,
            lastIntent: null
          };
          addLog(room, `${openingCoinFlipLine(openingCoinFlip)} Waiting for Start Game confirmation.`);
          break;
        }
        case 'confirm-coin-flip': {
          if (room.match.status !== 'coin-result' || !room.match.coinFlip?.awaitingConfirmation || !room.match.openingCoinFlip) throw new Error('No opening coin flip result is waiting for confirmation.');
          const p1 = [...room.players.values()].find((c) => c.seat === 1);
          const p2 = [...room.players.values()].find((c) => c.seat === 2);
          if (!p1 || !p2) throw new Error('Player 1 and Player 2 seats are required.');
          const openingCoinFlip = room.match.openingCoinFlip;
          const snap = applyOpeningCoinFlipToEngine(room.engine, openingCoinFlip, p1, p2);
          room.match = {
            ...room.match,
            status: 'started',
            startedAt: nowIso(),
            finishedAt: null,
            coinFlip: {
              pending: false,
              awaitingConfirmation: false,
              choice: openingCoinFlip.choice,
              outcome: openingCoinFlip.outcome,
              firstSeat: openingCoinFlip.firstSeat,
              firstSeatLabel: openingCoinFlip.firstSeatLabel,
              firstPlayerName: openingCoinFlip.firstPlayerName
            },
            serverBoard: snap.board,
            serverBoardRevision: snap.revision,
            lastIntent: null
          };
          addLog(room, `OPENING COIN FLIP CONFIRMED: ${openingCoinFlip.firstPlayerName} starts from Round 1 Draw Phase.`);
          addLog(room, `SERVER-AUTH HUMAN MATCH STARTED. ${p1.name} vs ${p2.name}. Canonical board lives in Node/Railway runtime; clients may only submit intents.`);
          break;
        }
        case 'reset-room': if (client.seat !== 1 && room.match.status !== 'finished') throw new Error('Only Player 1 may reset room before the match ends.'); room.engine = null; room.match = { status: 'setup', startedAt: null, finishedAt: null, hostSeat: 1, seed: null, coinFlip: null, result: null, serverBoard: null, serverBoardRevision: 0, lastIntent: null, mode: 'server-authoritative-human-vs-human' }; for (const p of room.players.values()) p.ready = false; addLog(room, `${client.name} reset the room to setup.`); break;
        case 'surrender-match': applyServerSurrender(room, client); break;
        case 'chat': addLog(room, `${client.name}: ${safeText(msg.message, 180)}`); break;
        case 'shared-board': throw new Error('Client board publish is disabled. This build is server-authoritative; send runtime-intent instead.');
        case 'runtime-intent': {
          if (client.role !== 'player') throw new Error('Only players can submit gameplay intents.');
          if (room.match.status !== 'started') throw new Error('Resolve the opening coin flip result before submitting gameplay intents.');
          if (!room.engine) throw new Error('Server runtime engine is not active.');
          const intent = safeText(msg.intent, 80);
          const baseRevision = Number(msg.baseRevision);
          if (Number.isFinite(baseRevision) && baseRevision > 0 && baseRevision !== room.engine.revision) throw new Error(`Stale client revision ${baseRevision}; server is at revision ${room.engine.revision}. Pull latest board and retry.`);
          const snap = room.engine.applyIntent(client.seat, intent, msg.args);
          room.match.serverBoard = snap.board;
          room.match.serverBoardRevision = snap.revision;
          room.match.lastIntent = { fromSeat: client.seat, fromName: client.name, intent, at: nowIso() };
          room.match.lastAnimationEvents = snap.animationEvents || [];
          room.match.lastAnimationEvent = snap.animationEvent || null;
          const st = snap.board?.appState;
          if (st?.gameOver) {
            room.match.status = 'finished';
            room.match.finishedAt = nowIso();
            const winnerSeat = st.winner === 'AI' ? 2 : 1;
            const loserSeat = winnerSeat === 1 ? 2 : 1;
            room.match.result = st.pvpGameResult || makePvpResult(room, winnerSeat, loserSeat, humanizeRuntimeText(st.gameEndReason || 'Game ended.'));
            room.match.serverBoard = snap.board;
            room.match.serverBoardRevision = snap.revision;
            addLog(room, `SERVER RUNTIME GAME END: ${room.match.result.winnerName} wins. ${room.match.result.reason}`);
          }
          else addLog(room, `SERVER INTENT r${snap.revision}: ${client.name} (${publicSeatLabel(client.seat)}) -> ${intent}.`);
          break;
        }
        default: throw new Error(`Unknown message type: ${safeText(msg.type, 60)}`);
      }
      broadcast(room);
    } catch (err) { reject(client, err?.message || err); }
  });

  ws.on('close', () => {
    // Ignore the close event from an older socket that was replaced by a successful reconnect.
    if (client.ws !== ws) return;
    client.connected = false;
    if (client.role === 'player') {
      const policy = startDisconnectReservation(room, client);
      const minutes = Math.round(policy.timeoutMs / 60000);
      addLog(room, `${client.name} disconnected from Player ${client.seat}. Reconnect reserved for ${minutes} minute${minutes === 1 ? '' : 's'} (${policy.reason}).`);
    } else {
      client.disconnectedAt = nowIso();
      addLog(room, `${client.name} disconnected as Spectator.`);
    }
    broadcast(room);
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000).unref();

setInterval(() => {
  for (const room of rooms.values()) {
    if (expireDisconnectedPlayers(room)) broadcast(room);
  }
}, DISCONNECT_SWEEP_MS).unref();

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60 * 12;
  for (const [id, room] of rooms) {
    const anyConnected = [...room.players.values(), ...room.spectators.values()].some((c) => c.connected !== false);
    const updated = Date.parse(room.updatedAt || room.createdAt || 0);
    if (!anyConnected && updated && updated < cutoff) rooms.delete(id);
  }
}, 1000 * 60 * 30).unref();

let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing HTTP/WebSocket server.`);
  for (const client of wss.clients) {
    try { client.close(1001, 'Server restarting'); } catch {}
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(VERSION);
  console.log(`Listening on http://0.0.0.0:${PORT}`);
  console.log('Health check: /health');
  console.log('WebSocket endpoint: /ws?room=ROOM&client=CLIENT&name=PLAYER&deck=STARTER_KEY');
});
