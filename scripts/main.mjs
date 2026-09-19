const MODULE_ID = "foundry-fm";
const SOCKET = `module.${MODULE_ID}`;

const DEFAULT_STATE = {
  videoId: "",
  url: "",
  title: "",
  status: "stopped",
  currentTime: 0,
  updatedAt: 0,
  revision: 0,
  loop: false,
  queueItemId: ""
};

const DEFAULT_QUEUE = {
  items: [],
  index: -1
};

const DEFAULT_BACKGROUND = "#111318";

let ytPlayer = null;
let ytReadyPromise = null;
let widget = null;
let launcher = null;
let applyingRemoteState = false;
let lastAppliedRevision = -1;
let openPlaylistEditorId = null;
let driftTimer = null;
let volumeSaveTimer = null;
let backgroundColorSaveTimer = null;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "playbackState", {
    name: "État du lecteur",
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_STATE)
  });

  game.settings.register(MODULE_ID, "queue", {
    name: "File d’attente",
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_QUEUE)
  });

  game.settings.register(MODULE_ID, "playlistsByUser", {
    name: "Playlists par profil MJ",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MODULE_ID, "youtubeApiKey", {
    name: "Clé API YouTube",
    hint: "Optionnelle. Permet d’utiliser la recherche YouTube intégrée. Pensez à restreindre la clé à votre domaine dans Google Cloud.",
    scope: "world",
    config: true,
    restricted: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "defaultVolume", {
    name: "Volume par défaut",
    hint: "Volume initial du lecteur pour ce navigateur.",
    scope: "client",
    config: true,
    type: Number,
    default: 35,
    range: { min: 0, max: 100, step: 1 }
  });

  game.settings.register(MODULE_ID, "backgroundColor", {
    name: "Couleur de fond",
    scope: "client",
    config: false,
    type: String,
    default: DEFAULT_BACKGROUND
  });
});

Hooks.once("ready", async () => {
  registerSocket();
  await migrateProfileBackgroundColor();
  createWidget();
  createFloatingLauncher();

  await ensureYouTubeAPI();
  await applyPersistedState({ force: true });

  if (driftTimer) clearInterval(driftTimer);
  driftTimer = setInterval(correctPlaybackDrift, 10000);
});


Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user?.id) return;

  const changedColor = foundry.utils.getProperty(changes, `flags.${MODULE_ID}.backgroundColor`);
  if (changedColor) applyBackgroundColor();
});

Hooks.on("updateSetting", async (setting) => {
  if (setting.key === `${MODULE_ID}.playbackState`) {
    await applyPersistedState();
    refreshWidget();
  }

  if (setting.key === `${MODULE_ID}.queue` || setting.key === `${MODULE_ID}.playlistsByUser`) {
    refreshWidget();
  }

});

function registerSocket() {
  game.socket?.on(SOCKET, async (message) => {
    if (!message || message.type !== "refresh") return;
    await applyPersistedState();
    refreshWidget();
  });
}

async function notifyClients() {
  game.socket?.emit(SOCKET, { type: "refresh", at: Date.now() });
}

function getState() {
  const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, "playbackState") ?? {});
  return { ...foundry.utils.deepClone(DEFAULT_STATE), ...stored };
}

function getQueue() {
  const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, "queue") ?? {});
  return {
    ...foundry.utils.deepClone(DEFAULT_QUEUE),
    ...stored,
    items: Array.isArray(stored.items) ? stored.items : []
  };
}

function getAllPlaylists() {
  const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, "playlistsByUser") ?? {});
  return stored && typeof stored === "object" ? stored : {};
}

function getProfilePlaylists() {
  if (!game.user?.isGM) return [];
  const all = getAllPlaylists();
  const playlists = all[game.user.id];
  return Array.isArray(playlists) ? playlists : [];
}

async function setProfilePlaylists(playlists) {
  if (!game.user.isGM) return;
  const all = getAllPlaylists();
  all[game.user.id] = playlists;
  await game.settings.set(MODULE_ID, "playlistsByUser", all);
  await notifyClients();
}

async function setState(patch) {
  if (!game.user.isGM) return;

  const previous = getState();
  const next = {
    ...previous,
    ...patch,
    updatedAt: Date.now(),
    revision: Number(previous.revision ?? 0) + 1
  };

  await game.settings.set(MODULE_ID, "playbackState", next);
  await notifyClients();
  return next;
}

async function setQueue(queue) {
  if (!game.user.isGM) return;
  await game.settings.set(MODULE_ID, "queue", queue);
  await notifyClients();
}

function extractVideoId(input = "") {
  const value = input.trim();
  if (!value) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] ?? "";
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] ?? "";
      if (url.pathname.startsWith("/live/")) return url.pathname.split("/")[2] ?? "";
    }
  } catch (_) {}

  const match = value.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? "";
}

function normalizeVideoUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function fetchVideoMetadata(videoId) {
  const fallback = {
    title: `YouTube · ${videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };

  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizeVideoUrl(videoId))}&format=json`;
    const response = await fetch(url);
    if (!response.ok) return fallback;
    const data = await response.json();
    return {
      title: data.title || fallback.title,
      author: data.author_name || "",
      thumbnail: data.thumbnail_url || fallback.thumbnail
    };
  } catch (_) {
    return fallback;
  }
}

function ensureYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (ytReadyPromise) return ytReadyPromise;

  ytReadyPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { previous?.(); } catch (_) {}
      resolve();
    };

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return ytReadyPromise;
}

async function ensurePlayer() {
  await ensureYouTubeAPI();
  if (ytPlayer) return ytPlayer;

  const target = document.getElementById("foundry-fm-player");
  if (!target) return null;

  ytPlayer = new YT.Player(target, {
    width: 356,
    height: 200,
    playerVars: {
      controls: game.user.isGM ? 1 : 0,
      playsinline: 1,
      rel: 0,
      disablekb: game.user.isGM ? 0 : 1,
      origin: window.location.origin
    },
    events: {
      onReady: async () => {
        ytPlayer.setVolume(getProfileVolume());
        await applyPersistedState({ force: true });
      },
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError
    }
  });

  return ytPlayer;
}

async function handlePlayerStateChange(event) {
  if (applyingRemoteState || !game.user.isGM) return;

  const state = getState();
  if (!state.videoId) return;

  const currentTime = safeCurrentTime();

  if (event.data === YT.PlayerState.PLAYING) {
    const drift = Math.abs(currentTime - expectedTime(state));
    if (state.status !== "playing" || drift > 1.75) {
      await setState({ status: "playing", currentTime });
    }
  } else if (event.data === YT.PlayerState.PAUSED && state.status !== "paused") {
    await setState({ status: "paused", currentTime });
  } else if (event.data === YT.PlayerState.ENDED) {
    if (state.loop) {
      await setState({ status: "playing", currentTime: 0 });
      applyingRemoteState = true;
      try {
        ytPlayer.seekTo(0, true);
        ytPlayer.playVideo();
      } finally {
        window.setTimeout(() => { applyingRemoteState = false; }, 250);
      }
    } else {
      await playNext();
    }
  }
}

function handlePlayerError(event) {
  const code = event?.data;
  if (game.user.isGM) {
    ui.notifications.warn(`Foundry FM : YouTube a refusé la lecture de cette vidéo (code ${code ?? "?"}).`);
  }
}

function safeCurrentTime() {
  try {
    return Number(ytPlayer?.getCurrentTime?.() ?? 0) || 0;
  } catch (_) {
    return 0;
  }
}

function expectedTime(state) {
  const base = Number(state.currentTime ?? 0);
  if (state.status !== "playing") return base;
  const elapsed = Math.max(0, Date.now() - Number(state.updatedAt ?? Date.now())) / 1000;
  return base + elapsed;
}

async function applyPersistedState({ force = false } = {}) {
  const state = getState();
  const revision = Number(state.revision ?? 0);

  if (!force && revision === lastAppliedRevision) return;
  lastAppliedRevision = revision;

  const player = await ensurePlayer();
  if (!player || !state.videoId) {
    refreshWidget();
    return;
  }

  applyingRemoteState = true;

  try {
    const currentVideoId = player.getVideoData?.()?.video_id ?? "";
    const targetTime = expectedTime(state);

    if (currentVideoId !== state.videoId) {
      if (state.status === "playing") {
        player.loadVideoById({ videoId: state.videoId, startSeconds: targetTime });
      } else {
        player.cueVideoById({ videoId: state.videoId, startSeconds: targetTime });
      }
    } else {
      const now = safeCurrentTime();
      if (Math.abs(now - targetTime) > 1.75) player.seekTo(targetTime, true);

      if (state.status === "playing") player.playVideo();
      else if (state.status === "paused") player.pauseVideo();
      else if (state.status === "stopped") player.stopVideo();
    }
  } catch (err) {
    console.warn("Foundry FM | Impossible d'appliquer l'état distant", err);
  } finally {
    window.setTimeout(() => { applyingRemoteState = false; }, 300);
    refreshWidget();
  }
}

async function correctPlaybackDrift() {
  const state = getState();
  if (!ytPlayer || !state.videoId) return;

  try {
    const currentId = ytPlayer.getVideoData?.()?.video_id ?? "";
    if (currentId !== state.videoId) return;

    const currentTime = safeCurrentTime();
    const target = expectedTime(state);
    const delta = target - currentTime;

    // Le MJ est la source d'autorité : un seek manuel dans le lecteur YouTube
    // doit être propagé, pas annulé par le correcteur de dérive.
    if (game.user.isGM) {
      if (!applyingRemoteState
        && (state.status === "playing" || state.status === "paused")
        && Math.abs(delta) > 2.25) {
        await setState({ currentTime, status: state.status });
      }
      return;
    }

    if (state.status !== "playing" || Math.abs(delta) <= 2.25) return;

    applyingRemoteState = true;
    ytPlayer.seekTo(target, true);
    window.setTimeout(() => { applyingRemoteState = false; }, 250);
  } catch (_) {}
}

async function playFromInput({ addOnly = false } = {}) {
  if (!game.user.isGM) return;

  const input = widget?.querySelector("[data-ft-url]");
  const videoId = extractVideoId(input?.value ?? "");

  if (!videoId) {
    ui.notifications.warn("Foundry FM : colle une URL YouTube valide.");
    return;
  }

  const meta = await fetchVideoMetadata(videoId);
  const item = {
    id: crypto.randomUUID?.() ?? foundry.utils.randomID(),
    videoId,
    url: normalizeVideoUrl(videoId),
    title: meta.title,
    author: meta.author ?? "",
    thumbnail: meta.thumbnail ?? ""
  };

  if (addOnly) {
    const queue = getQueue();
    queue.items.push(item);
    await setQueue(queue);
    ui.notifications.info(`Foundry FM : « ${item.title} » ajouté à la file.`);
    input.value = "";
    return;
  }

  const queue = getQueue();
  const existingIndex = queue.items.findIndex((entry) => entry.videoId === videoId);

  if (existingIndex >= 0) queue.index = existingIndex;
  else {
    queue.items.push(item);
    queue.index = queue.items.length - 1;
  }

  await setQueue(queue);
  const queuedItem = queue.items[queue.index] ?? item;
  await setState({
    videoId,
    url: item.url,
    title: item.title,
    status: "playing",
    currentTime: 0,
    queueItemId: queuedItem.id ?? ""
  });

  input.value = "";
  await applyPersistedState({ force: true });
}

async function togglePlayPause() {
  if (!game.user.isGM) return;

  const state = getState();
  if (!state.videoId) {
    await playFromInput();
    return;
  }

  if (state.status === "playing") {
    await setState({ status: "paused", currentTime: safeCurrentTime() });
  } else {
    await setState({ status: "playing", currentTime: safeCurrentTime() || state.currentTime || 0 });
  }
}

async function toggleLoop() {
  if (!game.user.isGM) return;
  const state = getState();
  await setState({ loop: !state.loop, currentTime: safeCurrentTime() || state.currentTime || 0 });
}

async function stopPlayback() {
  if (!game.user.isGM) return;
  await setState({ status: "stopped", currentTime: 0 });
}

async function seekBy(seconds) {
  if (!game.user.isGM) return;
  const state = getState();
  if (!state.videoId) return;
  const current = safeCurrentTime() || expectedTime(state);
  const target = Math.max(0, current + seconds);
  await setState({ currentTime: target, status: state.status });
}

async function playQueueIndex(index) {
  if (!game.user.isGM) return;

  const queue = getQueue();
  const item = queue.items[index];
  if (!item) return;

  queue.index = index;
  await setQueue(queue);
  await setState({
    videoId: item.videoId,
    url: item.url,
    title: item.title,
    status: "playing",
    currentTime: 0,
    queueItemId: item.id ?? ""
  });
}

async function playNext() {
  if (!game.user.isGM) return;
  const queue = getQueue();
  if (!queue.items.length) return stopPlayback();

  const next = queue.index + 1;
  if (next >= queue.items.length) return stopPlayback();
  await playQueueIndex(next);
}

async function playPrevious() {
  if (!game.user.isGM) return;
  const queue = getQueue();
  if (!queue.items.length) return;

  const state = getState();
  const selected = queue.items[queue.index];
  const selectedIsCurrent = Boolean(selected) && (
    state.queueItemId
      ? selected.id === state.queueItemId
      : selected.videoId === state.videoId
  );

  const previous = selectedIsCurrent ? queue.index - 1 : queue.index;
  if (previous < 0) return;
  await playQueueIndex(previous);
}

async function removeQueueItem(index) {
  if (!game.user.isGM) return;
  const queue = getQueue();
  if (!queue.items[index]) return;

  queue.items.splice(index, 1);

  if (!queue.items.length) queue.index = -1;
  else if (index < queue.index) queue.index -= 1;
  else if (index === queue.index) queue.index = index - 1;

  await setQueue(queue);
}

async function clearQueue() {
  if (!game.user.isGM) return;
  const queue = getQueue();
  if (!queue.items.length) return;

  const confirmed = await confirmSafeguard({
    title: "Vider la file d'attente",
    content: `<p>Retirer les <strong>${queue.items.length}</strong> morceau(x) actuellement présents dans la file ?</p>`,
    confirmLabel: "Vider",
    confirmIcon: "fa-trash"
  });
  if (!confirmed) return;

  await setQueue(foundry.utils.deepClone(DEFAULT_QUEUE));
}

async function createPlaylistFromQueue() {
  if (!game.user.isGM) return;

  const input = widget?.querySelector("[data-ft-playlist-name]");
  const name = input?.value?.trim();
  if (!name) {
    ui.notifications.warn("Foundry FM : donne un nom à la playlist.");
    return;
  }

  const playlists = getProfilePlaylists();
  if (playlists.some((playlist) => playlist.name.toLowerCase() === name.toLowerCase())) {
    ui.notifications.warn("Foundry FM : une playlist porte déjà ce nom sur ton profil.");
    return;
  }

  const queue = getQueue();
  playlists.push({
    id: crypto.randomUUID?.() ?? foundry.utils.randomID(),
    name,
    items: foundry.utils.deepClone(queue.items),
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  await setProfilePlaylists(playlists);
  input.value = "";
  ui.notifications.info(`Foundry FM : playlist « ${name} » créée pour ${game.user.name}.`);
}

async function loadPlaylist(playlistId, { append = false, autoplay = true } = {}) {
  if (!game.user.isGM) return;
  const playlist = getProfilePlaylists().find((entry) => entry.id === playlistId);
  if (!playlist) return;

  const existing = getQueue();
  const items = foundry.utils.deepClone(playlist.items ?? []);

  const queue = append
    ? { ...existing, items: [...existing.items, ...items] }
    : { items, index: autoplay && items.length ? 0 : -1 };

  await setQueue(queue);

  if (!append && autoplay && items.length) {
    await playQueueIndex(0);
  }
}

async function overwritePlaylistFromQueue(playlistId) {
  if (!game.user.isGM) return;

  const queue = getQueue();
  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist) return;

  const confirmed = await confirmSafeguard({
    title: "Remplacer le contenu de la playlist",
    content: `<p>Remplacer les <strong>${playlist.items?.length ?? 0}</strong> morceau(x) de <strong>« ${escapeHTML(playlist.name)} »</strong> par les <strong>${queue.items.length}</strong> morceau(x) de la file actuelle ?</p><p><em>L'ancien contenu de la playlist sera écrasé.</em></p>`,
    confirmLabel: "Remplacer",
    confirmIcon: "fa-arrows-rotate"
  });
  if (!confirmed) return;

  playlist.items = foundry.utils.deepClone(queue.items);
  playlist.updatedAt = Date.now();
  await setProfilePlaylists(playlists);
  ui.notifications.info(`Foundry FM : « ${playlist.name} » mise à jour.`);
}

async function renamePlaylist(playlistId, newName) {
  if (!game.user.isGM) return;
  const name = String(newName ?? "").trim();
  if (!name) {
    ui.notifications.warn("Foundry FM : le nom de la playlist ne peut pas être vide.");
    return;
  }

  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist) return;

  if (playlist.name === name) {
    ui.notifications.info("Foundry FM : le nom de la playlist est inchangé.");
    return;
  }

  const duplicate = playlists.some((entry) => entry.id !== playlistId && entry.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    ui.notifications.warn("Foundry FM : une autre playlist porte déjà ce nom.");
    return;
  }

  const confirmed = await confirmSafeguard({
    title: "Renommer la playlist",
    content: `<p>Renommer <strong>« ${escapeHTML(playlist.name)} »</strong> en <strong>« ${escapeHTML(name)} »</strong> ?</p>`,
    confirmLabel: "Renommer",
    confirmIcon: "fa-pen"
  });
  if (!confirmed) return;

  playlist.name = name;
  playlist.updatedAt = Date.now();
  await setProfilePlaylists(playlists);
  ui.notifications.info(`Foundry FM : playlist renommée « ${name} ».`);
}

async function addUrlToPlaylist(playlistId, rawValue) {
  if (!game.user.isGM) return;
  const videoId = extractVideoId(String(rawValue ?? ""));
  if (!videoId) {
    ui.notifications.warn("Foundry FM : colle une URL YouTube valide.");
    return false;
  }

  const meta = await fetchVideoMetadata(videoId);
  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist) return false;

  const confirmed = await confirmSafeguard({
    title: "Ajouter un morceau",
    content: `<p>Ajouter <strong>« ${escapeHTML(meta.title || videoId)} »</strong> à la playlist <strong>« ${escapeHTML(playlist.name)} »</strong> ?</p>`,
    confirmLabel: "Ajouter",
    confirmIcon: "fa-plus"
  });
  if (!confirmed) return false;

  playlist.items ??= [];
  playlist.items.push({
    id: crypto.randomUUID?.() ?? foundry.utils.randomID(),
    videoId,
    url: normalizeVideoUrl(videoId),
    title: meta.title,
    author: meta.author ?? "",
    thumbnail: meta.thumbnail ?? ""
  });
  playlist.updatedAt = Date.now();
  await setProfilePlaylists(playlists);
  ui.notifications.info(`Foundry FM : morceau ajouté à « ${playlist.name} ».`);
  return true;
}

async function appendQueueToPlaylist(playlistId) {
  if (!game.user.isGM) return;
  const queue = getQueue();
  if (!queue.items.length) {
    ui.notifications.warn("Foundry FM : la file actuelle est vide.");
    return;
  }

  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist) return;

  const confirmed = await confirmSafeguard({
    title: "Ajouter la file à la playlist",
    content: `<p>Ajouter les <strong>${queue.items.length}</strong> morceau(x) de la file actuelle à <strong>« ${escapeHTML(playlist.name)} »</strong> ?</p><p>Les morceaux déjà présents dans la playlist seront conservés.</p>`,
    confirmLabel: "Ajouter",
    confirmIcon: "fa-list"
  });
  if (!confirmed) return;

  playlist.items ??= [];
  playlist.items.push(...foundry.utils.deepClone(queue.items));
  playlist.updatedAt = Date.now();
  await setProfilePlaylists(playlists);
  ui.notifications.info(`Foundry FM : file actuelle ajoutée à « ${playlist.name} ».`);
}

async function removePlaylistTrack(playlistId, trackIndex) {
  if (!game.user.isGM) return;
  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  const track = playlist?.items?.[trackIndex];
  if (!track) return;

  const confirmed = await confirmSafeguard({
    title: "Retirer le morceau",
    content: `<p>Retirer <strong>« ${escapeHTML(track.title || track.videoId)} »</strong> de la playlist <strong>« ${escapeHTML(playlist.name)} »</strong> ?</p>`,
    confirmLabel: "Retirer",
    confirmIcon: "fa-trash"
  });
  if (!confirmed) return;

  playlist.items.splice(trackIndex, 1);
  playlist.updatedAt = Date.now();
  await setProfilePlaylists(playlists);
  ui.notifications.info(`Foundry FM : morceau retiré de « ${playlist.name} ».`);
}

async function movePlaylistTrack(playlistId, trackIndex, direction) {
  if (!game.user.isGM) return;
  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist?.items?.[trackIndex]) return;

  const target = trackIndex + direction;
  if (target < 0 || target >= playlist.items.length) return;

  [playlist.items[trackIndex], playlist.items[target]] = [playlist.items[target], playlist.items[trackIndex]];
  playlist.updatedAt = Date.now();
  await setProfilePlaylists(playlists);
}

function togglePlaylistEditor(playlistId) {
  openPlaylistEditorId = openPlaylistEditorId === playlistId ? null : playlistId;
  renderPlaylists();
}

async function deletePlaylist(playlistId) {
  if (!game.user.isGM) return;
  const playlists = getProfilePlaylists();
  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist) return;

  const confirmed = await confirmSafeguard({
    title: "Supprimer la playlist",
    content: `<p>Supprimer définitivement <strong>« ${escapeHTML(playlist.name)} »</strong> et ses <strong>${playlist.items?.length ?? 0}</strong> morceau(x) ?</p><p><em>Cette action ne peut pas être annulée.</em></p>`,
    confirmLabel: "Supprimer",
    confirmIcon: "fa-trash"
  });

  if (!confirmed) return;
  await setProfilePlaylists(playlists.filter((entry) => entry.id !== playlistId));
  if (openPlaylistEditorId === playlistId) openPlaylistEditorId = null;
  ui.notifications.info(`Foundry FM : playlist « ${playlist.name} » supprimée.`);
}

async function runSearch() {
  if (!game.user.isGM) return;

  const key = String(game.settings.get(MODULE_ID, "youtubeApiKey") ?? "").trim();
  if (!key) {
    ui.notifications.warn("Foundry FM : ajoute d’abord ta clé API YouTube dans les paramètres du module.");
    return;
  }

  const query = widget?.querySelector("[data-ft-search]")?.value?.trim();
  if (!query) return;

  const results = widget.querySelector("[data-ft-results]");
  results.innerHTML = `<div class="ft-loading"><i class="fas fa-spinner fa-spin"></i> Recherche…</div>`;

  try {
    const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
    endpoint.searchParams.set("part", "snippet");
    endpoint.searchParams.set("type", "video");
    endpoint.searchParams.set("maxResults", "8");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("key", key);

    const response = await fetch(endpoint);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);

    results.innerHTML = "";

    for (const entry of data.items ?? []) {
      const videoId = entry?.id?.videoId;
      if (!videoId) continue;

      const row = document.createElement("button");
      row.type = "button";
      row.className = "ft-search-result";
      row.dataset.videoId = videoId;
      row.innerHTML = `
        <img src="${escapeAttribute(entry.snippet?.thumbnails?.default?.url ?? "")}" alt="">
        <span>
          <strong>${escapeHTML(entry.snippet?.title ?? "Sans titre")}</strong>
          <small>${escapeHTML(entry.snippet?.channelTitle ?? "")}</small>
        </span>
      `;

      row.addEventListener("click", () => {
        widget.querySelector("[data-ft-url]").value = normalizeVideoUrl(videoId);
      });

      row.addEventListener("dblclick", async () => {
        widget.querySelector("[data-ft-url]").value = normalizeVideoUrl(videoId);
        await playFromInput();
      });

      results.appendChild(row);
    }
  } catch (err) {
    console.error("Foundry FM | Search", err);
    results.innerHTML = `<div class="ft-error">Recherche impossible : ${escapeHTML(err.message)}</div>`;
  }
}

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}


function getProfileStorageKey(key) {
  return `${MODULE_ID}.${key}.${game.user?.id ?? "anonymous"}`;
}

function getProfileVolume() {
  const flagged = Number(game.user?.getFlag?.(MODULE_ID, "volume"));
  if (Number.isFinite(flagged)) return Math.max(0, Math.min(100, flagged));

  const profileRaw = localStorage.getItem(getProfileStorageKey("volume"));
  if (profileRaw !== null) {
    const profileLocal = Number(profileRaw);
    if (Number.isFinite(profileLocal)) return Math.max(0, Math.min(100, profileLocal));
  }

  // Migration douce depuis la préférence locale des versions précédentes.
  const legacyRaw = localStorage.getItem(`${MODULE_ID}.volume`);
  if (legacyRaw !== null) {
    const legacy = Number(legacyRaw);
    if (Number.isFinite(legacy)) return Math.max(0, Math.min(100, legacy));
  }

  const configured = Number(game.settings.get(MODULE_ID, "defaultVolume") ?? 35);
  return Number.isFinite(configured) ? Math.max(0, Math.min(100, configured)) : 35;
}

function saveProfileVolume(value) {
  const volume = Math.max(0, Math.min(100, Number(value) || 0));

  // Sauvegarde locale immédiate de secours, séparée par profil.
  localStorage.setItem(getProfileStorageKey("volume"), String(volume));

  clearTimeout(volumeSaveTimer);
  volumeSaveTimer = setTimeout(async () => {
    try {
      await game.user?.setFlag?.(MODULE_ID, "volume", volume);
    } catch (err) {
      console.warn("Foundry FM | Impossible d'enregistrer le volume dans le profil, conservation locale.", err);
    }
  }, 300);
}


function getProfileBackgroundColor() {
  const flagged = String(game.user?.getFlag?.(MODULE_ID, "backgroundColor") ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(flagged)) return flagged;

  const localProfile = String(localStorage.getItem(getProfileStorageKey("backgroundColor")) ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(localProfile)) return localProfile;

  // Migration depuis la v0.3.1 : ancienne préférence client.
  const legacySetting = String(game.settings.get(MODULE_ID, "backgroundColor") ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(legacySetting)) return legacySetting;

  return DEFAULT_BACKGROUND;
}

function saveProfileBackgroundColor(value) {
  const color = /^#[0-9a-f]{6}$/i.test(String(value ?? ""))
    ? String(value)
    : DEFAULT_BACKGROUND;

  // Retour visuel et sauvegarde de secours immédiats.
  localStorage.setItem(getProfileStorageKey("backgroundColor"), color);
  widget?.style.setProperty("--ft-bg-color", color);

  clearTimeout(backgroundColorSaveTimer);
  backgroundColorSaveTimer = setTimeout(async () => {
    try {
      await game.user?.setFlag?.(MODULE_ID, "backgroundColor", color);
    } catch (err) {
      console.warn("Foundry FM | Impossible d'enregistrer la couleur dans le profil, conservation locale.", err);
    }
  }, 250);
}

async function migrateProfileBackgroundColor() {
  if (!game.user) return;

  const existing = String(game.user.getFlag?.(MODULE_ID, "backgroundColor") ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(existing)) return;

  const localProfile = String(localStorage.getItem(getProfileStorageKey("backgroundColor")) ?? "").trim();
  const legacySetting = String(game.settings.get(MODULE_ID, "backgroundColor") ?? "").trim();

  const candidate = /^#[0-9a-f]{6}$/i.test(localProfile)
    ? localProfile
    : /^#[0-9a-f]{6}$/i.test(legacySetting)
      ? legacySetting
      : DEFAULT_BACKGROUND;

  try {
    await game.user.setFlag(MODULE_ID, "backgroundColor", candidate);
  } catch (err) {
    console.warn("Foundry FM | Migration de la couleur de profil impossible, conservation locale.", err);
  }
}

async function confirmSafeguard({
  title,
  content,
  confirmLabel = "Confirmer",
  confirmIcon = "fa-check",
  cancelLabel = "Annuler"
}) {
  try {
    return await foundry.applications.api.DialogV2.confirm({
      window: { title },
      content,
      yes: {
        label: confirmLabel,
        icon: `<i class="fas ${confirmIcon}"></i>`
      },
      no: {
        label: cancelLabel,
        icon: "<i class='fas fa-xmark'></i>"
      }
    });
  } catch (err) {
    console.warn("Foundry FM | DialogV2 indisponible, utilisation de la confirmation navigateur.", err);
    const plain = String(content)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&laquo;|&raquo;/g, '"')
      .replace(/&nbsp;/g, " ");
    return window.confirm(plain);
  }
}

function createWidget() {
  document.getElementById("foundry-fm-widget")?.remove();

  widget = document.createElement("section");
  widget.id = "foundry-fm-widget";
  widget.classList.toggle("ft-listener-only", !game.user.isGM);

  widget.innerHTML = game.user.isGM ? gmWidgetHTML() : listenerWidgetHTML();
  document.body.appendChild(widget);

  restoreWidgetPosition();
  restoreWidgetState();
  applyBackgroundColor();
  bindWidgetEvents();
  setInitialVolume();
  refreshWidget();
  updateLauncherState();
}

function gmWidgetHTML() {
  return `
    <header class="ft-header" data-ft-drag-handle title="Double-clique pour minimiser">
      <div class="ft-brand">
        <i class="fas fa-radio"></i>
        <span>Foundry FM</span>
      </div>
      <div class="ft-header-actions">
        <label class="ft-color-picker" title="Couleur du fond de mon profil">
          <i class="fas fa-palette"></i>
          <input type="color" data-ft-color value="${escapeAttribute(getProfileBackgroundColor())}">
        </label>
        <div class="ft-status" data-ft-status>Prêt</div>
        <button type="button" class="ft-minimize-button" data-ft-minimize title="Minimiser"><i class="fas fa-window-minimize"></i></button>
      </div>
    </header>

    <div class="ft-body" data-ft-body>
      <div class="ft-video-shell">
        <div id="foundry-fm-player"></div>
        <button type="button" class="ft-enable" data-ft-enable>
          <i class="fas fa-volume-high"></i>
          Activer / resynchroniser
        </button>
      </div>

      <div class="ft-now-playing">
        <div class="ft-now-text">
          <strong data-ft-title>Aucune musique</strong>
          <small data-ft-subtitle>En attente</small>
        </div>
        <div class="ft-local-volume" title="Volume du profil">
          <i class="fas fa-volume-low"></i>
          <input type="range" min="0" max="100" step="1" data-ft-volume>
        </div>
      </div>

      <div class="ft-gm">
        <div class="ft-url-row">
          <input type="text" data-ft-url placeholder="URL YouTube ou ID de vidéo">
          <button type="button" data-ft-play-url title="Lire maintenant"><i class="fas fa-play"></i></button>
          <button type="button" data-ft-add-url title="Ajouter à la file"><i class="fas fa-plus"></i></button>
        </div>

        <div class="ft-controls">
          <button type="button" data-ft-prev title="Précédent"><i class="fas fa-backward-step"></i></button>
          <button type="button" data-ft-back title="-10 secondes"><i class="fas fa-rotate-left"></i><span>10</span></button>
          <button type="button" class="ft-main-control" data-ft-toggle title="Lecture / pause"><i class="fas fa-play"></i></button>
          <button type="button" data-ft-forward title="+10 secondes"><i class="fas fa-rotate-right"></i><span>10</span></button>
          <button type="button" data-ft-next title="Suivant"><i class="fas fa-forward-step"></i></button>
          <button type="button" data-ft-loop title="Lire le morceau en boucle"><i class="fas fa-repeat"></i></button>
          <button type="button" data-ft-stop title="Stop"><i class="fas fa-stop"></i></button>
        </div>

        <nav class="ft-tabs">
          <button type="button" class="active" data-ft-tab="queue"><i class="fas fa-list"></i> File</button>
          <button type="button" data-ft-tab="playlists"><i class="fas fa-music"></i> Playlists</button>
          <button type="button" data-ft-tab="search"><i class="fas fa-magnifying-glass"></i> Recherche</button>
        </nav>

        <div class="ft-panel active" data-ft-panel="queue">
          <div class="ft-panel-toolbar">
            <span>File d’attente</span>
            <button type="button" data-ft-clear title="Vider la file"><i class="fas fa-trash"></i></button>
          </div>
          <div class="ft-queue" data-ft-queue></div>
        </div>

        <div class="ft-panel" data-ft-panel="playlists">
          <div class="ft-playlist-create">
            <input type="text" data-ft-playlist-name placeholder="Nom de la nouvelle playlist">
            <button type="button" data-ft-create-playlist title="Créer avec la file actuelle"><i class="fas fa-plus"></i></button>
          </div>
          <div class="ft-profile-line"><i class="fas fa-user"></i> Playlists de <strong>${escapeHTML(game.user.name)}</strong></div>
          <div class="ft-playlists" data-ft-playlists></div>
        </div>

        <div class="ft-panel" data-ft-panel="search">
          <div class="ft-searchbar">
            <input type="search" data-ft-search placeholder="Rechercher sur YouTube">
            <button type="button" data-ft-search-btn><i class="fas fa-magnifying-glass"></i></button>
          </div>
          <div class="ft-results" data-ft-results>
            <div class="ft-empty">Configure une clé API YouTube dans les paramètres pour utiliser la recherche.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function listenerWidgetHTML() {
  return `
    <header class="ft-header ft-listener-header" data-ft-drag-handle title="Double-clique pour minimiser">
      <div class="ft-brand"><i class="fas fa-radio"></i><span>Foundry FM</span></div>
      <div class="ft-header-actions">
        <label class="ft-color-picker" title="Couleur du fond de mon profil">
          <i class="fas fa-palette"></i>
          <input type="color" data-ft-color value="${escapeAttribute(getProfileBackgroundColor())}">
        </label>
        <div class="ft-status" data-ft-status>Prêt</div>
        <button type="button" class="ft-minimize-button" data-ft-minimize title="Minimiser"><i class="fas fa-window-minimize"></i></button>
      </div>
    </header>
    <div class="ft-body">
      <div class="ft-video-shell ft-player-locked">
        <div id="foundry-fm-player"></div>
        <div class="ft-lock-overlay" aria-hidden="true"></div>
        <button type="button" class="ft-enable" data-ft-enable>
          <i class="fas fa-volume-high"></i>
          Activer le son
        </button>
      </div>
      <div class="ft-now-playing">
        <div class="ft-now-text">
          <strong data-ft-title>Aucune musique</strong>
          <small data-ft-subtitle>Le MJ contrôle la diffusion</small>
        </div>
        <div class="ft-local-volume" title="Volume du profil">
          <i class="fas fa-volume-low"></i>
          <input type="range" min="0" max="100" step="1" data-ft-volume>
        </div>
      </div>
    </div>
  `;
}

function bindWidgetEvents() {
  widget.querySelector("[data-ft-enable]")?.addEventListener("click", async () => {
    await applyPersistedState({ force: true });
    try { ytPlayer?.unMute?.(); } catch (_) {}
  });

  const volume = widget.querySelector("[data-ft-volume]");
  volume?.addEventListener("input", (event) => {
    const value = Number(event.currentTarget.value);
    saveProfileVolume(value);
    try { ytPlayer?.setVolume?.(value); } catch (_) {}
  });

  const colorPicker = widget.querySelector("[data-ft-color]");
  colorPicker?.addEventListener("input", (event) => {
    saveProfileBackgroundColor(event.currentTarget.value || DEFAULT_BACKGROUND);
  });

  // Déplacement et minimisation sont disponibles pour tous les profils,
  // y compris les joueurs et lorsque le monde est en pause.
  widget.querySelector("[data-ft-minimize]")?.addEventListener("click", toggleMinimized);

  const header = widget.querySelector("[data-ft-drag-handle]");
  header?.addEventListener("dblclick", (event) => {
    if (event.target.closest("button, input, label")) return;
    toggleMinimized();
  });

  bindDrag();

  if (!game.user.isGM) return;

  widget.querySelector("[data-ft-play-url]")?.addEventListener("click", () => playFromInput());
  widget.querySelector("[data-ft-add-url]")?.addEventListener("click", () => playFromInput({ addOnly: true }));
  widget.querySelector("[data-ft-toggle]")?.addEventListener("click", togglePlayPause);
  widget.querySelector("[data-ft-loop]")?.addEventListener("click", toggleLoop);
  widget.querySelector("[data-ft-stop]")?.addEventListener("click", stopPlayback);
  widget.querySelector("[data-ft-back]")?.addEventListener("click", () => seekBy(-10));
  widget.querySelector("[data-ft-forward]")?.addEventListener("click", () => seekBy(10));
  widget.querySelector("[data-ft-prev]")?.addEventListener("click", playPrevious);
  widget.querySelector("[data-ft-next]")?.addEventListener("click", playNext);
  widget.querySelector("[data-ft-clear]")?.addEventListener("click", clearQueue);
  widget.querySelector("[data-ft-search-btn]")?.addEventListener("click", runSearch);
  widget.querySelector("[data-ft-create-playlist]")?.addEventListener("click", createPlaylistFromQueue);

  widget.querySelector("[data-ft-url]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") playFromInput();
  });

  widget.querySelector("[data-ft-search]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });

  widget.querySelector("[data-ft-playlist-name]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createPlaylistFromQueue();
  });

  widget.querySelectorAll("[data-ft-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.ftTab;
      widget.querySelectorAll("[data-ft-tab]").forEach((entry) => entry.classList.toggle("active", entry === button));
      widget.querySelectorAll("[data-ft-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.ftPanel === tab);
      });
    });
  });

}

function setInitialVolume() {
  const slider = widget.querySelector("[data-ft-volume]");
  if (!slider) return;

  const volume = getProfileVolume();
  slider.value = String(volume);
  try { ytPlayer?.setVolume?.(volume); } catch (_) {}
}

function applyBackgroundColor() {
  if (!widget) return;
  const color = getProfileBackgroundColor();
  widget.style.setProperty("--ft-bg-color", color);

  const picker = widget.querySelector("[data-ft-color]");
  if (picker && /^#[0-9a-f]{6}$/i.test(color)) picker.value = color;
}

function toggleMinimized() {
  if (!widget) return;
  const minimized = !widget.classList.contains("ft-minimized");
  widget.classList.toggle("ft-minimized", minimized);
  localStorage.setItem(getProfileStorageKey("minimized"), minimized ? "1" : "0");

  const icon = widget.querySelector("[data-ft-minimize] i");
  if (icon) icon.className = minimized ? "fas fa-window-maximize" : "fas fa-window-minimize";
}

function isWidgetVisible() {
  if (!widget) return false;
  return !widget.hidden && !widget.classList.contains("ft-fully-hidden");
}

function setWidgetVisible(visible, { persist = true } = {}) {
  if (!widget) return;

  if (visible) {
    widget.hidden = false;
    widget.classList.remove("ft-fully-hidden");
    widget.style.removeProperty("display");
    widget.style.removeProperty("visibility");
  } else {
    widget.hidden = true;
    widget.classList.add("ft-fully-hidden");
    widget.style.setProperty("display", "none", "important");
    widget.style.setProperty("visibility", "hidden", "important");
  }

  if (persist) {
    localStorage.setItem(getProfileStorageKey("visible"), visible ? "1" : "0");
  }

  updateLauncherState();
}

function toggleWidgetVisibility() {
  if (!widget) return;
  setWidgetVisible(!isWidgetVisible());
}

function restoreWidgetState() {
  const profileVisible = localStorage.getItem(getProfileStorageKey("visible"));
  const legacyVisible = localStorage.getItem(`${MODULE_ID}.visible`);
  const visible = profileVisible ?? legacyVisible;

  setWidgetVisible(visible !== "0", { persist: false });

  const profileMinimized = localStorage.getItem(getProfileStorageKey("minimized"));
  const legacyMinimized = localStorage.getItem(`${MODULE_ID}.minimized`);
  const minimized = (profileMinimized ?? legacyMinimized) === "1";

  widget.classList.toggle("ft-minimized", minimized);

  const icon = widget.querySelector("[data-ft-minimize] i");
  if (icon) icon.className = minimized ? "fas fa-window-maximize" : "fas fa-window-minimize";
}

function refreshWidget() {
  if (!widget) return;

  const state = getState();
  const queue = getQueue();

  const title = widget.querySelector("[data-ft-title]");
  const subtitle = widget.querySelector("[data-ft-subtitle]");
  const status = widget.querySelector("[data-ft-status]");
  const toggleIcon = widget.querySelector("[data-ft-toggle] i");
  const loopButton = widget.querySelector("[data-ft-loop]");

  if (title) title.textContent = state.title || "Aucune musique";
  if (subtitle) {
    subtitle.textContent = state.videoId
      ? state.status === "playing" ? "Lecture synchronisée"
      : state.status === "paused" ? "En pause"
      : "Arrêté"
      : game.user.isGM ? "En attente" : "Le MJ contrôle la diffusion";
  }

  if (status) {
    status.textContent = state.status === "playing" ? "Lecture" : state.status === "paused" ? "Pause" : "Prêt";
    status.dataset.state = state.status;
  }

  if (toggleIcon) toggleIcon.className = state.status === "playing" ? "fas fa-pause" : "fas fa-play";
  if (loopButton) {
    loopButton.classList.toggle("active", Boolean(state.loop));
    loopButton.title = state.loop ? "Boucle activée" : "Lire le morceau en boucle";
  }

  if (game.user.isGM) {
    renderQueue(queue, state);
    renderPlaylists();
  }

  updateLauncherState();
}

function renderQueue(queue, state = getState()) {
  const container = widget?.querySelector("[data-ft-queue]");
  if (!container) return;
  container.innerHTML = "";

  if (!queue.items.length) {
    container.innerHTML = `<div class="ft-empty">La file est vide.</div>`;
    return;
  }

  const selected = queue.items[queue.index];
  const selectedIsCurrent = Boolean(selected) && (
    state.queueItemId
      ? selected.id === state.queueItemId
      : selected.videoId === state.videoId
  );

  queue.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `ft-queue-item${selectedIsCurrent && index === queue.index ? " active" : ""}`;

    row.innerHTML = `
      <button type="button" class="ft-queue-play" title="Lire">
        <span class="ft-index">${index + 1}</span>
        <img src="${escapeAttribute(item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`)}" alt="">
        <span class="ft-queue-text">
          <strong>${escapeHTML(item.title || item.videoId)}</strong>
          <small>${escapeHTML(item.author || "YouTube")}</small>
        </span>
      </button>
      <button type="button" class="ft-remove" title="Retirer"><i class="fas fa-xmark"></i></button>
    `;

    row.querySelector(".ft-queue-play").addEventListener("click", () => playQueueIndex(index));
    row.querySelector(".ft-remove").addEventListener("click", () => removeQueueItem(index));
    container.appendChild(row);
  });
}

function renderPlaylists() {
  const container = widget?.querySelector("[data-ft-playlists]");
  if (!container) return;
  container.innerHTML = "";

  const playlists = getProfilePlaylists();
  if (!playlists.length) {
    container.innerHTML = `<div class="ft-empty">Aucune playlist pour ce profil MJ.<br><small>La création copie la file actuelle.</small></div>`;
    return;
  }

  for (const playlist of playlists) {
    const count = playlist.items?.length ?? 0;
    const isEditing = openPlaylistEditorId === playlist.id;
    const card = document.createElement("div");
    card.className = `ft-playlist-card${isEditing ? " editing" : ""}`;

    const tracksHTML = (playlist.items ?? []).map((item, index) => `
      <div class="ft-playlist-track" data-track-index="${index}">
        <span class="ft-playlist-track-index">${index + 1}</span>
        <img src="${escapeAttribute(item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`)}" alt="">
        <span class="ft-playlist-track-text">
          <strong>${escapeHTML(item.title || item.videoId)}</strong>
          <small>${escapeHTML(item.author || "YouTube")}</small>
        </span>
        <span class="ft-playlist-track-actions">
          <button type="button" data-track-action="up" title="Monter" ${index === 0 ? "disabled" : ""}><i class="fas fa-chevron-up"></i></button>
          <button type="button" data-track-action="down" title="Descendre" ${index === count - 1 ? "disabled" : ""}><i class="fas fa-chevron-down"></i></button>
          <button type="button" data-track-action="remove" title="Retirer"><i class="fas fa-xmark"></i></button>
        </span>
      </div>
    `).join("");

    card.innerHTML = `
      <div class="ft-playlist-item">
        <div class="ft-playlist-info">
          <i class="fas fa-compact-disc"></i>
          <span><strong>${escapeHTML(playlist.name)}</strong><small>${count} morceau${count > 1 ? "x" : ""}</small></span>
        </div>
        <div class="ft-playlist-actions">
          <button type="button" data-action="play" title="Charger et lire"><i class="fas fa-play"></i></button>
          <button type="button" data-action="append" title="Ajouter à la file"><i class="fas fa-plus"></i></button>
          <button type="button" data-action="edit" title="Renommer et modifier le contenu"><i class="fas fa-pen"></i></button>
          <button type="button" data-action="delete" title="Supprimer"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      ${isEditing ? `
        <div class="ft-playlist-editor">
          <div class="ft-playlist-editor-title"><i class="fas fa-pen-to-square"></i> Modifier la playlist</div>
          <div class="ft-playlist-rename-row">
            <input type="text" data-edit-playlist-name value="${escapeAttribute(playlist.name)}" aria-label="Nom de la playlist">
            <button type="button" data-action="rename" title="Enregistrer le nouveau nom"><i class="fas fa-check"></i></button>
          </div>
          <div class="ft-playlist-add-row">
            <input type="text" data-add-playlist-url placeholder="Ajouter une URL YouTube">
            <button type="button" data-action="add-url" title="Ajouter cette vidéo"><i class="fas fa-plus"></i></button>
          </div>
          <div class="ft-playlist-editor-tools">
            <button type="button" data-action="append-queue"><i class="fas fa-list"></i> Ajouter la file actuelle</button>
            <button type="button" data-action="replace-queue"><i class="fas fa-arrows-rotate"></i> Remplacer par la file</button>
          </div>
          <div class="ft-playlist-track-list">
            ${tracksHTML || `<div class="ft-empty">Cette playlist est vide.</div>`}
          </div>
        </div>
      ` : ""}
    `;

    card.querySelector('[data-action="play"]').addEventListener("click", () => loadPlaylist(playlist.id));
    card.querySelector('[data-action="append"]').addEventListener("click", () => loadPlaylist(playlist.id, { append: true, autoplay: false }));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => togglePlaylistEditor(playlist.id));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deletePlaylist(playlist.id));

    if (isEditing) {
      const nameInput = card.querySelector('[data-edit-playlist-name]');
      const urlInput = card.querySelector('[data-add-playlist-url]');

      card.querySelector('[data-action="rename"]')?.addEventListener("click", () => renamePlaylist(playlist.id, nameInput?.value));
      nameInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") renamePlaylist(playlist.id, nameInput.value);
      });

      card.querySelector('[data-action="add-url"]')?.addEventListener("click", async () => {
        const added = await addUrlToPlaylist(playlist.id, urlInput?.value);
        if (added && urlInput) urlInput.value = "";
      });
      urlInput?.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") return;
        const added = await addUrlToPlaylist(playlist.id, urlInput.value);
        if (added) urlInput.value = "";
      });

      card.querySelector('[data-action="append-queue"]')?.addEventListener("click", () => appendQueueToPlaylist(playlist.id));
      card.querySelector('[data-action="replace-queue"]')?.addEventListener("click", () => overwritePlaylistFromQueue(playlist.id));

      card.querySelectorAll('[data-track-action]').forEach((button) => {
        button.addEventListener("click", () => {
          const row = button.closest('[data-track-index]');
          const index = Number(row?.dataset.trackIndex);
          if (!Number.isInteger(index)) return;
          const action = button.dataset.trackAction;
          if (action === "up") movePlaylistTrack(playlist.id, index, -1);
          else if (action === "down") movePlaylistTrack(playlist.id, index, 1);
          else if (action === "remove") removePlaylistTrack(playlist.id, index);
        });
      });
    }

    container.appendChild(card);
  }
}

function bindDrag() {
  const handle = widget.querySelector("[data-ft-drag-handle]");
  if (!handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, input, label")) return;
    dragging = true;

    const rect = widget.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    widget.style.left = `${rect.left}px`;
    widget.style.top = `${rect.top}px`;
    widget.style.right = "auto";
    widget.style.bottom = "auto";
    handle.setPointerCapture?.(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    const maxX = Math.max(0, window.innerWidth - widget.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - 60);
    const x = Math.min(maxX, Math.max(0, event.clientX - offsetX));
    const y = Math.min(maxY, Math.max(0, event.clientY - offsetY));

    widget.style.left = `${x}px`;
    widget.style.top = `${y}px`;
  });

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    localStorage.setItem(getProfileStorageKey("position"), JSON.stringify({
      left: widget.style.left,
      top: widget.style.top
    }));
  };

  handle.addEventListener("pointerup", stop);
  handle.addEventListener("pointercancel", stop);
}

function restoreWidgetPosition() {
  const raw = localStorage.getItem(getProfileStorageKey("position"))
    ?? localStorage.getItem(`${MODULE_ID}.position`);
  if (!raw) return;

  try {
    const pos = JSON.parse(raw);
    if (pos.left && pos.top) {
      widget.style.left = pos.left;
      widget.style.top = pos.top;
      widget.style.right = "auto";
      widget.style.bottom = "auto";
    }
  } catch (_) {}
}


function createFloatingLauncher() {
  document.getElementById("foundry-fm-scene-control-button")?.remove();
  document.querySelector('[data-ft-scene-control-wrapper="true"]')?.remove();
  document.getElementById("foundry-fm-launcher")?.remove();

  launcher = document.createElement("button");
  launcher.id = "foundry-fm-launcher";
  launcher.type = "button";
  launcher.className = "ft-floating-launcher";
  launcher.setAttribute("aria-label", "Ouvrir ou fermer Foundry FM");
  launcher.setAttribute("title", "Foundry FM");
  launcher.innerHTML = `
    <span class="ft-launcher-notes" aria-hidden="true">
      <i class="fas fa-music note-a"></i>
      <i class="fas fa-music note-b"></i>
    </span>
    <i class="fas fa-radio ft-launcher-radio" aria-hidden="true"></i>
  `;

  document.body.appendChild(launcher);
  restoreLauncherPosition();
  bindLauncherEvents();
  updateLauncherState();
}

function bindLauncherEvents() {
  if (!launcher) return;

  const DRAG_THRESHOLD = 7;

  let pressed = false;
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  launcher.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();

    pressed = true;
    dragging = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;

    const rect = launcher.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    launcher.style.left = `${startLeft}px`;
    launcher.style.top = `${startTop}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";

    launcher.setPointerCapture?.(pointerId);
    launcher.classList.add("pressed");
  });

  launcher.addEventListener("pointermove", (event) => {
    if (!pressed || event.pointerId !== pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      dragging = true;
      launcher.classList.add("dragging");
    }

    if (!dragging) return;

    event.preventDefault();

    const maxX = Math.max(0, window.innerWidth - launcher.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - launcher.offsetHeight);

    const x = Math.min(maxX, Math.max(0, startLeft + dx));
    const y = Math.min(maxY, Math.max(0, startTop + dy));

    launcher.style.left = `${x}px`;
    launcher.style.top = `${y}px`;
  });

  const finishPointer = (event, cancelled = false) => {
    if (!pressed || event.pointerId !== pointerId) return;

    const wasDragging = dragging;

    pressed = false;
    dragging = false;
    launcher.classList.remove("pressed", "dragging");

    if (wasDragging) {
      localStorage.setItem(getProfileStorageKey("launcherPosition"), JSON.stringify({
        left: launcher.style.left,
        top: launcher.style.top
      }));
    } else if (!cancelled) {
      toggleWidgetVisibility();
    }

    try {
      launcher.releasePointerCapture?.(pointerId);
    } catch (_) {}

    pointerId = null;
  };

  launcher.addEventListener("pointerup", (event) => finishPointer(event, false));
  launcher.addEventListener("pointercancel", (event) => finishPointer(event, true));

  launcher.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleWidgetVisibility();
  });
}

function restoreLauncherPosition() {
  if (!launcher) return;

  const raw = localStorage.getItem(getProfileStorageKey("launcherPosition"));
  if (!raw) return;

  try {
    const pos = JSON.parse(raw);
    if (pos.left && pos.top) {
      launcher.style.left = pos.left;
      launcher.style.top = pos.top;
      launcher.style.right = "auto";
      launcher.style.bottom = "auto";
    }
  } catch (_) {}
}

function updateLauncherState() {
  if (!launcher) return;

  const state = getState();
  const visible = isWidgetVisible();

  launcher.classList.toggle("active", visible);
  launcher.classList.toggle("playing", state.status === "playing");
  launcher.setAttribute("aria-pressed", visible ? "true" : "false");
  launcher.title = visible ? "Masquer Foundry FM" : "Afficher Foundry FM";
}


