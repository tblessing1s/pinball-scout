function safeUrl(value) {
  try {
    return new URL(value, window.location.origin);
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(value) {
  const url = safeUrl(value);
  if (!url) return "";

  const hostname = url.hostname.replace(/^www\./, "");
  let videoId = "";

  if (hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") || "";
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] || "";
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] || "";
    }
  }

  if (!videoId) return "";

  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
  embedUrl.searchParams.set("rel", "0");
  embedUrl.searchParams.set("modestbranding", "1");
  embedUrl.searchParams.set("autoplay", "1");
  return embedUrl.toString();
}

export function canEmbedVideoUrl(value) {
  return Boolean(getYouTubeEmbedUrl(value));
}

export function renderVideoAction({ url, label, title = "" }) {
  if (canEmbedVideoUrl(url)) {
    return `<button class="btn btn-secondary small" type="button" data-video-url="${url}" data-video-title="${title || label}">${label}</button>`;
  }

  return `<a class="btn btn-secondary small" href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
}

export function renderVideoModal(activeVideo) {
  if (!activeVideo?.url) return "";

  const embedUrl = getYouTubeEmbedUrl(activeVideo.url);
  if (!embedUrl) return "";

  return `
    <div class="modal-backdrop" data-action="close-video-modal">
      <div class="modal-panel video-modal" role="dialog" aria-modal="true" aria-labelledby="video-modal-title">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Video Preview</p>
            <h3 id="video-modal-title">${activeVideo.title || "Pinball video"}</h3>
          </div>
          <button class="btn btn-secondary small" type="button" data-action="close-video-modal">Close</button>
        </div>
        <div class="video-modal-frame">
          <iframe
            src="${embedUrl}"
            title="${activeVideo.title || "Pinball video"}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            loading="eager"
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
      </div>
    </div>
  `;
}
