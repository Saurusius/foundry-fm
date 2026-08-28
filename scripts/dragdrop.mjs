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

function enhancePlaylistEditors() {
  const container = document.querySelector("#foundry-fm-widget [data-ft-playlists]");
  if (!container) return;

  const playlists = getProfilePlaylists();
  const cards = [...container.querySelectorAll(".ft-playlist-card")];

  cards.forEach((card, playlistIndex) => {
    const playlist = playlists[playlistIndex];
    if (!playlist) return;

    card.dataset.ftDndPlaylistId = playlist.id;

    const trackList = card.querySelector(".ft-playlist-track-list");
    if (!trackList) return;

    if (!card.querySelector(".ft-playlist-dnd-hint")) {
      const hint = document.createElement("div");
      hint.className = "ft-playlist-dnd-hint";
      hint.innerHTML = '<i class="fas fa-grip-vertical"></i><span>Glisse-dépose les morceaux pour les réorganiser</span>';
      trackList.before(hint);
    }

    const rows = [...trackList.querySelectorAll(".ft-playlist-track")];
    rows.forEach((row, trackIndex) => enhanceTrackRow(row, playlist.id, trackIndex));
  });
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

  if (row.dataset.ftDndBound === "1") return;
  row.dataset.ftDndBound = "1";

  handle.addEventListener("dragstart", (event) => startDrag(event, row));
  handle.addEventListener("dragend", endDrag);
  row.addEventListener("dragover", (event) => dragOverTrack(event, row));
  row.addEventListener("dragleave", (event) => dragLeaveTrack(event, row));
  row.addEventListener("drop", (event) => dropOnTrack(event, row));
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
