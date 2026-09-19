const MODULE_ID = "foundry-fm";
const SOCKET = `module.${MODULE_ID}`;

let observer = null;
let enhanceScheduled = false;
let draggedTrack = null;

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;

  enhancePlaylistEditors();
  observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, { childList: true, subtree: true });
});

function scheduleEnhance() {
  if (enhanceScheduled) return;
  enhanceScheduled = true;

  requestAnimationFrame(() => {
    enhanceScheduled = false;
    enhancePlaylistEditors();
  });
}

function getProfilePlaylists() {
  const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, "playlistsByUser") ?? {});
  const playlists = all?.[game.user.id];
  return Array.isArray(playlists) ? playlists : [];
}

function getQueue() {
  const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, "queue") ?? {});
  return {
    items: Array.isArray(stored.items) ? stored.items : [],
    index: Number.isInteger(stored.index) ? stored.index : -1
  };
}

async function saveQueue(queue, source = "playlist-track-queue") {
  await game.settings.set(MODULE_ID, "queue", queue);
  game.socket?.emit(SOCKET, { type: "refresh", at: Date.now(), source });
}

function cloneTrackForQueue(track) {
  const item = foundry.utils.deepClone(track ?? {});
  item.id = crypto.randomUUID?.() ?? foundry.utils.randomID();
  return item;
}

function enhancePlaylistEditors() {
  const container = document.querySelector("#foundry-fm-widget [data-ft-playlists]");
  if (!container) return;

  const playlists = getProfilePlaylists();
  const cards = [...container.querySelectorAll(".ft-playlist-card")];

  cards.forEach((card, playlistIndex) => {
    const playlist = playlists[playlistIndex];
    if (!playlist) return;

    card.dataset.ftDndPlaylistId = playlist.id;
    enhancePlaylistCardActions(card);

    const trackList = card.querySelector(".ft-playlist-track-list");
    if (!trackList) return;

    if (!card.querySelector(".ft-playlist-dnd-hint")) {
      const hint = document.createElement("div");
      hint.className = "ft-playlist-dnd-hint";
      hint.innerHTML = '<i class="fas fa-grip-vertical"></i><span>Glisse-dépose pour réorganiser · <i class="fas fa-plus"></i> ajoute à la file · <i class="fas fa-forward-step"></i> lit ensuite</span>';
      trackList.before(hint);
    }

    const rows = [...trackList.querySelectorAll(".ft-playlist-track")];
    rows.forEach((row, trackIndex) => enhanceTrackRow(row, playlist.id, trackIndex));
  });
}

function enhancePlaylistCardActions(card) {
  const actions = card.querySelector(".ft-playlist-actions");
  const editButton = actions?.querySelector('[data-action="edit"]');
  if (!actions || !editButton) return;

  editButton.title = "Voir / modifier les pistes";

  if (actions.querySelector("[data-ft-browse-tracks]")) return;

  const browseButton = document.createElement("button");
  browseButton.type = "button";
  browseButton.dataset.ftBrowseTracks = "1";
  browseButton.title = "Voir les pistes et en choisir pour la file";
  browseButton.setAttribute("aria-label", "Voir les pistes de la playlist");
  browseButton.innerHTML = '<i class="fas fa-list-ul"></i>';

  browseButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    editButton.click();
  });

  actions.insertBefore(browseButton, editButton);
}

function enhanceTrackRow(row, playlistId, trackIndex) {
  row.dataset.ftDndPlaylistId = playlistId;
  row.dataset.ftDndIndex = String(trackIndex);

  let handle = row.querySelector(".ft-playlist-drag-handle");
  if (!handle) {
    handle = document.createElement("span");
    handle.className = "ft-playlist-drag-handle";
    handle.draggable = true;
    handle.tabIndex = 0;
    handle.title = "Maintenir et glisser pour déplacer le morceau";
    handle.setAttribute("aria-label", "Déplacer le morceau par glisser-déposer");
    handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
    row.prepend(handle);
  }

  enhanceTrackQueueActions(row, playlistId, trackIndex);

  if (row.dataset.ftDndBound === "1") return;
  row.dataset.ftDndBound = "1";

  handle.addEventListener("dragstart", (event) => startDrag(event, row));
  handle.addEventListener("dragend", endDrag);
  row.addEventListener("dragover", (event) => dragOverTrack(event, row));
  row.addEventListener("dragleave", (event) => dragLeaveTrack(event, row));
  row.addEventListener("drop", (event) => dropOnTrack(event, row));
}

function enhanceTrackQueueActions(row, playlistId, trackIndex) {
  const actions = row.querySelector(".ft-playlist-track-actions");
  if (!actions) return;

  if (!actions.querySelector('[data-track-action="queue-add"]')) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.dataset.trackAction = "queue-add";
    addButton.className = "ft-track-queue-action";
    addButton.title = "Ajouter ce morceau à la fin de la file";
    addButton.setAttribute("aria-label", "Ajouter à la file");
    addButton.innerHTML = '<i class="fas fa-plus"></i>';
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      addPlaylistTrackToQueue(playlistId, trackIndex, { playNext: false });
    });
    actions.prepend(addButton);
  }

  if (!actions.querySelector('[data-track-action="queue-next"]')) {
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.dataset.trackAction = "queue-next";
    nextButton.className = "ft-track-next-action";
    nextButton.title = "Lire ce morceau juste après le morceau en cours";
    nextButton.setAttribute("aria-label", "Lire ensuite");
    nextButton.innerHTML = '<i class="fas fa-forward-step"></i>';
    nextButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      addPlaylistTrackToQueue(playlistId, trackIndex, { playNext: true });
    });

    const addButton = actions.querySelector('[data-track-action="queue-add"]');
    addButton?.insertAdjacentElement("afterend", nextButton);
  }
}

async function addPlaylistTrackToQueue(playlistId, trackIndex, { playNext = false } = {}) {
  if (!game.user?.isGM) return;

  const playlist = getProfilePlaylists().find((entry) => entry.id === playlistId);
  const track = playlist?.items?.[trackIndex];
  if (!track) return;

  const queue = getQueue();
  const item = cloneTrackForQueue(track);

  if (playNext) {
    const insertIndex = queue.index >= 0
      ? Math.min(queue.index + 1, queue.items.length)
      : 0;
    queue.items.splice(insertIndex, 0, item);
  } else {
    queue.items.push(item);
  }

  await saveQueue(queue, playNext ? "playlist-track-next" : "playlist-track-add");

  const title = track.title || track.videoId || "Morceau";
  ui.notifications.info(
    playNext
      ? `Foundry FM : « ${title} » sera lu ensuite.`
      : `Foundry FM : « ${title} » ajouté à la file.`
  );
}

function startDrag(event, row) {
  const playlistId = row.dataset.ftDndPlaylistId;
  const index = Number(row.dataset.ftDndIndex);
  if (!playlistId || !Number.isInteger(index)) {
    event.preventDefault();
    return;
  }

  draggedTrack = { playlistId, fromIndex: index, row };
  row.classList.add("ft-playlist-track-dragging");
  document.body.classList.add("ft-playlist-drag-active");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({ playlistId, fromIndex: index }));
  }
}

function dragOverTrack(event, row) {
  if (!draggedTrack) return;
  if (row.dataset.ftDndPlaylistId !== draggedTrack.playlistId) return;

  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";

  clearDropIndicators(row.closest(".ft-playlist-card"));

  const rect = row.getBoundingClientRect();
  const after = event.clientY > rect.top + (rect.height / 2);
  row.classList.toggle("ft-drop-before", !after);
  row.classList.toggle("ft-drop-after", after);
}

function dragLeaveTrack(event, row) {
  const related = event.relatedTarget;
  if (related && row.contains(related)) return;
  row.classList.remove("ft-drop-before", "ft-drop-after");
}

async function dropOnTrack(event, row) {
  if (!draggedTrack) return;
  if (row.dataset.ftDndPlaylistId !== draggedTrack.playlistId) return;

  event.preventDefault();
  event.stopPropagation();

  const targetIndex = Number(row.dataset.ftDndIndex);
  if (!Number.isInteger(targetIndex)) {
    endDrag();
    return;
  }

  const position = row.classList.contains("ft-drop-after") ? "after" : "before";
  const { playlistId, fromIndex } = draggedTrack;

  clearDropIndicators(row.closest(".ft-playlist-card"));
  await reorderPlaylistTrack(playlistId, fromIndex, targetIndex, position);
  endDrag();
}

async function reorderPlaylistTrack(playlistId, fromIndex, targetIndex, position) {
  if (!game.user?.isGM) return;

  const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, "playlistsByUser") ?? {});
  const playlists = all?.[game.user.id];
  if (!Array.isArray(playlists)) return;

  const playlist = playlists.find((entry) => entry.id === playlistId);
  if (!playlist || !Array.isArray(playlist.items)) return;

  if (fromIndex < 0 || fromIndex >= playlist.items.length) return;
  if (targetIndex < 0 || targetIndex >= playlist.items.length) return;

  let insertIndex = targetIndex + (position === "after" ? 1 : 0);
  if (fromIndex < insertIndex) insertIndex -= 1;

  const [moved] = playlist.items.splice(fromIndex, 1);
  insertIndex = Math.max(0, Math.min(insertIndex, playlist.items.length));

  if (insertIndex === fromIndex) {
    playlist.items.splice(fromIndex, 0, moved);
    return;
  }

  playlist.items.splice(insertIndex, 0, moved);
  playlist.updatedAt = Date.now();

  await game.settings.set(MODULE_ID, "playlistsByUser", all);
  game.socket?.emit(SOCKET, { type: "refresh", at: Date.now(), source: "playlist-dragdrop" });

  ui.notifications.info(`Foundry FM : ordre de « ${playlist.name} » mis à jour.`);
}

function clearDropIndicators(scope = document) {
  scope?.querySelectorAll?.(".ft-drop-before, .ft-drop-after").forEach((row) => {
    row.classList.remove("ft-drop-before", "ft-drop-after");
  });
}

function endDrag() {
  draggedTrack?.row?.classList.remove("ft-playlist-track-dragging");
  clearDropIndicators(document);
  document.body.classList.remove("ft-playlist-drag-active");
  draggedTrack = null;
}
