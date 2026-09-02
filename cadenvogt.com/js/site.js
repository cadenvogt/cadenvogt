(function () {
  "use strict";

  var GAP = 8;
  var ALBUMS = {
    "35mm-film-photography": {
      title: "35mm Film",
      dataUrl: "data/film-photography.json",
    },
    "expired-film": {
      title: "Expired Film",
      dataUrl: "data/expired-film.json",
    },
    "multiple-exposures": {
      title: "Multiple Exposures",
      dataUrl: "data/multiple-exposures.json?v=2",
    },
    reworks: {
      title: "Reworks",
      dataUrl: "data/reworks.json",
    },
    "brand-work": {
      title: "Brand Work",
      dataUrl: "data/brand-work.json",
    },
    "providence-art-show": {
      title: "Providence Art Show",
      dataUrl: "data/providence-art-show.json",
    },
    textures: {
      title: "Textures",
      dataUrl: "data/textures.json",
    },
    "logos-clothing": {
      title: "Logos/Clothing",
      dataUrl: "data/logos-clothing.json?v=2",
    },
    "social-media-ads": {
      title: "Social Media Ads",
      dataUrl: "data/social-media-ads.json?v=order32154",
      keepOrder: true,
      scramble: false,
      player: "video",
      stack: true,
    },
    "super-8": {
      title: "Super 8",
      dataUrl: "data/super-8.json",
      keepOrder: true,
      scramble: false,
      player: "video",
      stack: true,
    },
    "full-length-videos": {
      title: "Full-Length Videos",
      dataUrl: "data/full-length-videos.json?v=year",
      keepOrder: true,
      scramble: false,
      player: "youtube",
      stack: true,
    },
  };

  var state = {
    photos: [],
    albums: {},
    scrambledAlbums: {},
    lightboxIndex: 0,
    menuOpen: false,
    scrambling: false,
    scrambleTimer: null,
    scanTimer: null,
    scanDeck: [],
    scanCurrent: null,
    scanBusy: false,
    scanPaused: false,
  };

  var els = {};

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function shuffle(list) {
    var arr = list.slice();
    var i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function shuffleDifferent(list, storageKey) {
    if (list.length < 2) return list.slice();
    var key = storageKey || "cv-last-order";
    var previous;
    try {
      previous = sessionStorage.getItem(key);
    } catch (e) {
      previous = null;
    }
    var next = shuffle(list);
    var signature = next.map(function (p) { return p.src; }).join("|");
    var attempts = 0;
    while (previous && signature === previous && attempts < 8) {
      next = shuffle(list);
      signature = next.map(function (p) { return p.src; }).join("|");
      attempts += 1;
    }
    try {
      sessionStorage.setItem(key, signature);
    } catch (e) { /* ignore private-mode quota */ }
    return next;
  }

  function isAboutPhoto(photo) {
    return !!(photo && photo.src && /(?:^|\/)about\.jpe?g$/i.test(photo.src));
  }

  function isVideo(item) {
    return !!(item && (item.type === "video" || item.type === "youtube" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(item.src || "")));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function allSitePhotos() {
    var seen = {};
    var list = [];
    Object.keys(ALBUMS).forEach(function (id) {
      (state.albums[id] || []).forEach(function (photo) {
        if (!photo || !photo.src || seen[photo.src] || isAboutPhoto(photo) || isVideo(photo)) return;
        seen[photo.src] = true;
        list.push({
          src: photo.src,
          width: photo.width,
          height: photo.height,
          album: id,
        });
      });
    });
    return list;
  }

  function mixAcrossCategories(photos, lastAlbum) {
    var buckets = {};
    photos.forEach(function (photo) {
      var id = photo.album || "other";
      if (!buckets[id]) buckets[id] = [];
      buckets[id].push(photo);
    });
    Object.keys(buckets).forEach(function (id) {
      buckets[id] = shuffle(buckets[id]);
    });
    var order = [];
    var last = lastAlbum || null;
    while (true) {
      var available = Object.keys(buckets).filter(function (id) {
        return buckets[id].length;
      });
      if (!available.length) break;
      var choices = available;
      if (last && available.length > 1) {
        choices = available.filter(function (id) { return id !== last; });
        if (!choices.length) choices = available;
      }
      var pickId = choices[Math.floor(Math.random() * choices.length)];
      order.push(buckets[pickId].shift());
      last = pickId;
    }
    return order;
  }

  function mixDifferent(photos, storageKey) {
    if (photos.length < 2) return photos.slice();
    var next = mixAcrossCategories(photos);
    var signature = next.map(function (p) { return p.src; }).join("|");
    var previous;
    try {
      previous = sessionStorage.getItem(storageKey);
    } catch (e) {
      previous = null;
    }
    var attempts = 0;
    while (previous && signature === previous && attempts < 8) {
      next = mixAcrossCategories(photos);
      signature = next.map(function (p) { return p.src; }).join("|");
      attempts += 1;
    }
    try {
      sessionStorage.setItem(storageKey, signature);
    } catch (e) { /* ignore private-mode quota */ }
    return next;
  }

  function route() {
    var hash = (location.hash || "#/").replace(/^#/, "");
    if (hash.charAt(0) !== "/") hash = "/" + hash;
    hash = hash.replace(/\/+$/, "") || "/";
    if (hash === "/film-photography/35mm" || hash === "/35mm-film-photography") {
      return { name: "album", id: "35mm-film-photography" };
    }
    if (hash === "/film-photography/expired" || hash === "/expired-film") {
      return { name: "album", id: "expired-film" };
    }
    if (hash === "/film-photography/multiple-exposures" || hash === "/multiple-exposures") {
      return { name: "album", id: "multiple-exposures" };
    }
    if (hash === "/design/reworks" || hash === "/film-photography/reworks" || hash === "/reworks") {
      return { name: "album", id: "reworks" };
    }
    if (hash === "/film-photography/brand-work" || hash === "/brand-work") {
      return { name: "album", id: "brand-work" };
    }
    if (hash === "/film-photography/providence-art-show" || hash === "/providence-art-show") {
      return { name: "album", id: "providence-art-show" };
    }
    if (hash === "/design/textures" || hash === "/textures") {
      return { name: "album", id: "textures" };
    }
    if (hash === "/design/logos-clothing" || hash === "/logos-clothing") {
      return { name: "album", id: "logos-clothing" };
    }
    if (hash === "/videography/social-media-ads" || hash === "/social-media-ads") {
      return { name: "album", id: "social-media-ads" };
    }
    if (hash === "/videography/super-8" || hash === "/super-8") {
      return { name: "album", id: "super-8" };
    }
    if (hash === "/videography/full-length-videos" || hash === "/full-length-videos") {
      return { name: "album", id: "full-length-videos" };
    }
    if (hash === "/film-photography" || hash === "/design" || hash === "/videography") {
      return { name: "home", id: "home" };
    }
    if (hash === "/about") {
      return { name: "about", id: "about" };
    }
    return { name: "home", id: "home" };
  }

  function setCurrentNav(id) {
    document.querySelectorAll(".nav a").forEach(function (link) {
      var on = link.getAttribute("data-nav") === id;
      link.classList.toggle("is-current", on);
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function closeMenu() {
    state.menuOpen = false;
    if (els.drawer) els.drawer.classList.remove("is-open");
    if (els.backdrop) els.backdrop.classList.remove("is-open");
    if (els.menuToggle) els.menuToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function openMenu() {
    state.menuOpen = true;
    if (els.drawer) els.drawer.classList.add("is-open");
    if (els.backdrop) els.backdrop.classList.add("is-open");
    if (els.menuToggle) els.menuToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function toggleMenu() {
    if (state.menuOpen) closeMenu();
    else openMenu();
  }

  function columnCount(width) {
    if (width >= 1100) return 3;
    if (width >= 560) return 2;
    return 1;
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function computeMasonry(tiles, width) {
    var cols = columnCount(width);
    var colW = (width - GAP * (cols - 1)) / cols;
    var heights = new Array(cols).fill(0);
    var positions = [];
    tiles.forEach(function (tile) {
      var w = Number(tile.getAttribute("data-w"));
      var h = Number(tile.getAttribute("data-h"));
      var col = heights.indexOf(Math.min.apply(Math, heights));
      var x = Math.round(col * (colW + GAP));
      var y = Math.round(heights[col]);
      var renderH = colW * (h / w);
      positions.push({ tile: tile, x: x, y: y, w: colW, h: renderH });
      heights[col] += renderH + GAP;
    });
    return {
      positions: positions,
      height: Math.ceil(Math.max.apply(Math, heights)),
    };
  }

  function applyMasonry(layout) {
    layout.positions.forEach(function (p) {
      p.tile.style.width = p.w + "px";
      p.tile.style.height = p.h + "px";
      p.tile.style.transition = "none";
      p.tile.style.transform = "translate(" + p.x + "px," + p.y + "px)";
    });
    els.grid.style.height = layout.height + "px";
  }

  function scrambleToLayout(layout) {
    var grid = els.grid;
    var vw = grid.clientWidth;
    var viewH = Math.max(window.innerHeight - 140, 480);
    var scatterH = Math.min(viewH, 640);

    state.scrambling = true;
    grid.classList.add("is-scrambling");
    grid.classList.remove("is-settling");

    layout.positions.forEach(function (p, i) {
      p.tile.style.width = p.w + "px";
      p.tile.style.height = p.h + "px";
      p.tile.style.transition = "none";
      p.tile.style.zIndex = String(200 + (i % 40));
      var startX = Math.round(Math.random() * Math.max(0, vw - p.w));
      var startY = Math.round(Math.random() * Math.max(80, scatterH - p.h * 0.35));
      var rot = ((Math.random() * 22) - 11).toFixed(2);
      p.tile.style.transform = "translate(" + startX + "px," + startY + "px) rotate(" + rot + "deg)";
    });
    grid.style.height = Math.max(layout.height, scatterH + 80) + "px";

    void grid.offsetWidth;

    grid.classList.add("is-settling");
    layout.positions.forEach(function (p, i) {
      var delay = 30 + (i % 14) * 32 + Math.round(Math.random() * 90);
      p.tile.style.transition =
        "transform 0.95s cubic-bezier(0.22, 1, 0.36, 1) " + delay + "ms";
      p.tile.style.transform = "translate(" + p.x + "px," + p.y + "px) rotate(0deg)";
    });
    grid.style.transition = "height 0.95s cubic-bezier(0.22, 1, 0.36, 1)";
    grid.style.height = layout.height + "px";

    clearTimeout(state.scrambleTimer);
    state.scrambleTimer = setTimeout(function () {
      state.scrambling = false;
      grid.classList.remove("is-scrambling", "is-settling");
      grid.style.transition = "";
      layout.positions.forEach(function (p) {
        p.tile.style.transition = "";
        p.tile.style.zIndex = "";
      });
    }, 1700);
  }

  function layoutGrid(opts) {
    var grid = els.grid;
    if (!grid || grid.classList.contains("is-stack") || (state.scrambling && !(opts && opts.animate))) return;
    var tiles = grid.querySelectorAll(".tile");
    if (!tiles.length) return;
    var layout = computeMasonry(tiles, grid.clientWidth);
    var shouldAnimate = opts && opts.animate && !reduceMotion();
    if (shouldAnimate) scrambleToLayout(layout);
    else applyMasonry(layout);
  }

  function markLoaded(img) {
    img.classList.add("is-loaded");
  }

  function bindImage(img) {
    if (img.complete && img.naturalWidth) markLoaded(img);
    else {
      img.addEventListener("load", function () { markLoaded(img); });
      img.addEventListener("error", function () { markLoaded(img); });
    }
  }

  function bindVideo(video) {
    function ready() { markLoaded(video); }
    if (video.readyState >= 2) ready();
    else {
      video.addEventListener("loadeddata", ready);
      video.addEventListener("error", ready);
    }
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    var play = video.play();
    if (play && play.catch) play.catch(function () {});
  }

  function stopScanner() {
    clearTimeout(state.scanTimer);
    state.scanTimer = null;
    state.scanBusy = false;
  }

  function preloadPhoto(photo) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(photo); };
      img.onerror = function () { resolve(photo); };
      img.src = photo.src;
    });
  }

  function sizeScannerStage() {
    var gate = $("#scanner-gate");
    var film = $(".film");
    if (!gate || !film) return;
    var maxW = Math.min(els.main.clientWidth - 8, 900);
    var topPad = window.innerWidth > 767 ? 50 : 66;
    var maxH = Math.max(320, window.innerHeight - topPad - 40);
    gate.style.width = Math.round(maxW) + "px";
    gate.style.height = Math.round(maxH) + "px";
    film.style.width = Math.round(maxW) + "px";
  }

  function nextScanPhoto() {
    if (!state.scanDeck.length) {
      var pool = state.photos;
      if (state.scanCurrent) {
        pool = state.photos.filter(function (p) {
          return p.src !== state.scanCurrent.src;
        });
      }
      state.scanDeck = mixAcrossCategories(pool, state.scanCurrent && state.scanCurrent.album);
    }
    return state.scanDeck.shift() || state.photos[0];
  }

  function applyFrame(img, photo) {
    img.src = photo.src;
    img.width = photo.width;
    img.height = photo.height;
    img.alt = "Film photograph by Caden Vogt";
  }

  function finishScanSwap(incoming, current, nextPhoto, scanner) {
    scanner.classList.remove("is-scanning");
    applyFrame(current, nextPhoto);
    bindImage(current);
    incoming.style.clipPath = "";
    incoming.removeAttribute("src");
    incoming.style.opacity = "";
    var gate = $("#scanner-gate");
    if (gate) gate.setAttribute("data-index", String(state.photos.indexOf(nextPhoto)));
    state.scanCurrent = nextPhoto;
    state.scanBusy = false;
    scheduleScanAdvance();
  }

  function scheduleScanAdvance() {
    if (state.scanPaused || route().name !== "home") return;
    var wait = reduceMotion() ? 5200 : 3800 + Math.round(Math.random() * 2200);
    clearTimeout(state.scanTimer);
    state.scanTimer = setTimeout(runScanAdvance, wait);
  }

  function runScanAdvance() {
    if (state.scanPaused || state.scanBusy || route().name !== "home") return;
    if (document.hidden) {
      scheduleScanAdvance();
      return;
    }
    var nextPhoto = nextScanPhoto();
    if (!nextPhoto) return;
    state.scanBusy = true;
    var scanner = $(".scanner");
    var current = $(".frame-current");
    var incoming = $(".frame-incoming");
    if (!scanner || !current || !incoming) {
      state.scanBusy = false;
      return;
    }

    preloadPhoto(nextPhoto).then(function () {
      if (route().name !== "home" || state.scanPaused) {
        state.scanBusy = false;
        return;
      }
      applyFrame(incoming, nextPhoto);

      if (reduceMotion()) {
        applyFrame(current, nextPhoto);
        incoming.removeAttribute("src");
        var gate = $("#scanner-gate");
        if (gate) gate.setAttribute("data-index", String(state.photos.indexOf(nextPhoto)));
        state.scanCurrent = nextPhoto;
        state.scanBusy = false;
        scheduleScanAdvance();
        return;
      }

      scanner.classList.remove("is-scanning");
      void scanner.offsetWidth;
      scanner.classList.add("is-scanning");

      clearTimeout(state.scanTimer);
      state.scanTimer = setTimeout(function () {
        finishScanSwap(incoming, current, nextPhoto, scanner);
      }, 2700);
    });
  }

  function startScanner(firstPhoto) {
    stopScanner();
    state.scanPaused = false;
    state.scanCurrent = firstPhoto;
    state.scanDeck = mixAcrossCategories(state.photos.filter(function (p) {
      return p.src !== firstPhoto.src;
    }), firstPhoto.album);
    sizeScannerStage();
    scheduleScanAdvance();
  }

  function renderHome() {
    setCurrentNav("home");
    document.title = "Caden Vogt";
    state.photos = mixDifferent(allSitePhotos(), "cv-last-order-home");
    var photo = state.photos[0];
    if (!photo) {
      els.main.innerHTML = '<div class="main-wrap"></div>';
      return;
    }
    els.main.innerHTML =
      '<div class="main-wrap">' +
        '<div class="scanner" aria-label="Film scanner gallery">' +
          '<div class="film">' +
            '<button type="button" class="gate js-open-lightbox" id="scanner-gate" data-index="0" aria-label="View photograph">' +
              '<img class="frame-current" alt="Film photograph by Caden Vogt" decoding="async">' +
              '<img class="frame-incoming" alt="" decoding="async">' +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>";
    var current = $(".frame-current");
    applyFrame(current, photo);
    bindImage(current);
    startScanner(photo);
  }

  function youtubeThumbUrl(id, kind) {
    return "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/" + (kind || "maxresdefault") + ".jpg";
  }

  function bindYoutubeThumb(img) {
    var id = img.getAttribute("data-yt");
    function done() {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      markLoaded(img);
    }
    function onLoad() {
      if (id && img.naturalWidth && img.naturalWidth < 200) {
        img.src = youtubeThumbUrl(id, "hqdefault");
        return;
      }
      done();
    }
    function onError() {
      if (id && img.getAttribute("data-fallback") !== "1") {
        img.setAttribute("data-fallback", "1");
        img.src = youtubeThumbUrl(id, "hqdefault");
        return;
      }
      done();
    }
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    if (img.complete) onLoad();
  }

  function playYoutubeEmbed(button) {
    var id = button.getAttribute("data-id");
    var title = button.getAttribute("data-title") || "Video";
    var frame = button.closest(".yt-frame");
    if (!id || !frame) return;
    frame.innerHTML =
      '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&rel=0" title="' + escapeHtml(title) +
      ' by Caden Vogt" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }

  function renderYoutubeStack(album, videos) {
    var html = '<div class="main-wrap"><h1 class="page-title">' + escapeHtml(album.title) + '</h1><div class="yt-stack" id="grid">';
    videos.forEach(function (video, i) {
      var title = escapeHtml(video.title);
      var duration = escapeHtml(video.duration);
      var year = video.year ? ' <span class="yt-year">' + escapeHtml(video.year) + "</span>" : "";
      var id = encodeURIComponent(video.id);
      html +=
        '<article class="yt-item">' +
          '<p class="yt-meta"><span class="yt-title">' + title + "</span>" + year + ' <span class="yt-length">' + duration + "</span></p>" +
          '<div class="yt-frame">' +
            '<button type="button" class="yt-play js-play-youtube" data-id="' + id +
            '" data-title="' + title + '" aria-label="Play ' + title + '">' +
              '<img class="yt-thumb" data-yt="' + id + '" src="' + youtubeThumbUrl(video.id) +
              '" alt="' + title + '" width="1280" height="720" decoding="async" loading="' +
              (i < 4 ? "eager" : "lazy") + '">' +
              '<span class="yt-play-icon" aria-hidden="true"></span>' +
            "</button>" +
          "</div>" +
        "</article>";
    });
    html += "</div></div>";
    els.main.innerHTML = html;
    els.grid = $("#grid");
    els.grid.querySelectorAll(".yt-thumb").forEach(bindYoutubeThumb);
  }

  function renderAlbum() {
    var id = route().id;
    var album = ALBUMS[id];
    var photos = state.albums[id] || [];
    if (!album) {
      renderHome();
      return;
    }
    state.photos = photos;
    setCurrentNav(id);
    document.title = album.title + " — Caden Vogt";
    if (album.player === "youtube") {
      renderYoutubeStack(album, photos);
      return;
    }
    var layoutClass = album.stack ? "grid is-stack" : "grid";
    var html = '<div class="main-wrap"><h1 class="page-title">' + album.title + '</h1><div class="' + layoutClass + '" id="grid">';
    var openClass = album.player === "video" ? "js-open-player" : "js-open-lightbox";
    photos.forEach(function (photo, i) {
      html +=
        '<a class="tile ' + openClass + '" href="' + photo.src + '" data-index="' + i +
        '" data-w="' + photo.width + '" data-h="' + photo.height +
        '" style="aspect-ratio:' + photo.width + '/' + photo.height + '">';
      if (isVideo(photo)) {
        html +=
          '<video src="' + photo.src + '" width="' + photo.width + '" height="' + photo.height +
          '" muted loop playsinline autoplay preload="metadata" aria-label="' + album.title +
          ' video by Caden Vogt"></video>';
      } else {
        html +=
          '<img src="' + photo.src + '" width="' + photo.width + '" height="' + photo.height +
          '" alt="' + album.title + ' photograph by Caden Vogt" decoding="async" loading="' +
          (i < 8 ? "eager" : "lazy") + '">';
      }
      html += "</a>";
    });
    html += "</div></div>";
    els.main.innerHTML = html;
    els.grid = $("#grid");
    els.grid.querySelectorAll("img").forEach(bindImage);
    els.grid.querySelectorAll("video").forEach(bindVideo);
    if (!album.stack) {
      layoutGrid({ animate: album.scramble !== false && !state.scrambledAlbums[id] });
      if (album.scramble !== false) state.scrambledAlbums[id] = true;
    }
  }

  function renderAbout() {
    setCurrentNav("about");
    document.title = "About — Caden Vogt";
    els.main.innerHTML =
      '<div class="main-wrap">' +
        '<article class="about">' +
          '<h1 class="page-title">About</h1>' +
          '<p class="lede">Caden Vogt is a photographer, videographer, and graphic designer based in Greater Boston, Massachusetts.</p>' +
          '<p>A Providence College graduate, he works across analog and digital mediums — 35mm film, video, and design — to build a body of work that is tactile, considered, and ready for professional use.</p>' +
          '<img class="about-photo" src="images/about.jpg" width="678" height="1024" alt="Caden Vogt" decoding="async">' +
        "</article>" +
      "</div>";
  }

  function render() {
    stopScanner();
    closeMenu();
    closeLightbox();
    closePlayer();
    els.grid = null;
    var r = route();
    els.main.classList.toggle("is-home", r.name === "home");
    if (r.name === "about") renderAbout();
    else if (r.name === "album") renderAlbum();
    else renderHome();
  }

  function stopLightboxVideo() {
    if (!els.lightboxVideo) return;
    els.lightboxVideo.pause();
    els.lightboxVideo.removeAttribute("src");
    els.lightboxVideo.load();
  }

  function openLightbox(index) {
    if (!state.photos.length) return;
    state.lightboxIndex = (index + state.photos.length) % state.photos.length;
    var photo = state.photos[state.lightboxIndex];
    var video = isVideo(photo);
    els.lightbox.classList.toggle("is-video", video);
    if (video) {
      els.lightboxImg.removeAttribute("src");
      els.lightboxImg.alt = "";
      els.lightboxVideo.src = photo.src;
      els.lightboxVideo.muted = true;
      els.lightboxVideo.loop = true;
      els.lightboxVideo.playsInline = true;
      var play = els.lightboxVideo.play();
      if (play && play.catch) play.catch(function () {});
    } else {
      stopLightboxVideo();
      els.lightboxImg.src = photo.src;
      els.lightboxImg.alt = "Photograph by Caden Vogt";
    }
    els.lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (route().name === "home") {
      state.scanPaused = true;
      clearTimeout(state.scanTimer);
    }
  }

  function closeLightbox() {
    if (!els.lightbox) return;
    els.lightbox.classList.remove("is-open", "is-video");
    stopLightboxVideo();
    if (!state.menuOpen) document.body.style.overflow = "";
    if (route().name === "home" && state.scanPaused) {
      state.scanPaused = false;
      scheduleScanAdvance();
    }
  }

  function pauseGridVideos() {
    if (!els.grid) return;
    els.grid.querySelectorAll("video").forEach(function (video) {
      video.pause();
    });
  }

  function resumeGridVideos() {
    if (!els.grid) return;
    els.grid.querySelectorAll("video").forEach(function (video) {
      video.muted = true;
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
    });
  }

  function openPlayer(index) {
    if (!state.photos.length || !els.player || !els.playerVideo) return;
    state.lightboxIndex = (index + state.photos.length) % state.photos.length;
    var item = state.photos[state.lightboxIndex];
    pauseGridVideos();
    els.playerVideo.pause();
    els.playerVideo.removeAttribute("src");
    els.playerVideo.load();
    els.playerVideo.muted = false;
    els.playerVideo.volume = 1;
    els.playerVideo.loop = false;
    els.playerVideo.controls = false;
    els.playerVideo.playsInline = true;
    if (els.playerScrub) els.playerScrub.value = "0";
    els.player.classList.add("is-open");
    document.body.style.overflow = "hidden";

    var start = function () {
      try { els.playerVideo.currentTime = 0; } catch (err) {}
      els.playerVideo.muted = false;
      els.playerVideo.volume = 1;
      var play = els.playerVideo.play();
      if (play && play.catch) play.catch(function () {});
    };
    els.playerVideo.addEventListener("loadedmetadata", start, { once: true });
    els.playerVideo.src = item.src.split("#")[0] + "#t=0.001";
    els.playerVideo.load();
  }

  function closePlayer() {
    if (!els.player) return;
    if (!els.player.classList.contains("is-open") && !(els.playerVideo && els.playerVideo.src)) {
      return;
    }
    els.player.classList.remove("is-open");
    if (els.playerVideo) {
      els.playerVideo.pause();
      els.playerVideo.removeAttribute("src");
      els.playerVideo.load();
    }
    if (!state.menuOpen && !els.lightbox.classList.contains("is-open")) {
      document.body.style.overflow = "";
    }
    resumeGridVideos();
  }

  function lightboxStep(delta) {
    openLightbox(state.lightboxIndex + delta);
  }

  function onMainClick(e) {
    var playerLink = e.target.closest(".js-open-player");
    if (playerLink) {
      e.preventDefault();
      openPlayer(Number(playerLink.getAttribute("data-index") || 0));
      return;
    }
    var ytPlay = e.target.closest(".js-play-youtube");
    if (ytPlay) {
      e.preventDefault();
      playYoutubeEmbed(ytPlay);
      return;
    }
    var link = e.target.closest(".js-open-lightbox");
    if (!link) return;
    e.preventDefault();
    var index = Number(link.getAttribute("data-index") || 0);
    openLightbox(index);
  }

  function onKey(e) {
    if (e.key === "Escape") {
      if (els.player && els.player.classList.contains("is-open")) closePlayer();
      else if (els.lightbox.classList.contains("is-open")) closeLightbox();
      else if (state.menuOpen) closeMenu();
      return;
    }
    if (els.player && els.player.classList.contains("is-open")) return;
    if (!els.lightbox.classList.contains("is-open")) return;
    if (e.key === "ArrowRight") lightboxStep(1);
    if (e.key === "ArrowLeft") lightboxStep(-1);
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!state.scrambling) layoutGrid();
      if (route().name === "home") sizeScannerStage();
    }, 80);
    if (window.innerWidth > 767 && state.menuOpen) closeMenu();
  }

  function init() {
    els.main = $("#main");
    els.drawer = $("#mobile-drawer");
    els.backdrop = $("#backdrop");
    els.menuToggle = $("#menu-toggle");
    els.lightbox = $("#lightbox");
    els.lightboxImg = $("#lightbox-image");
    els.lightboxVideo = $("#lightbox-video");
    els.player = $("#video-player");
    els.playerVideo = $("#player-video");
    els.playerScrub = $("#player-scrub");

    els.menuToggle.addEventListener("click", toggleMenu);
    els.backdrop.addEventListener("click", closeMenu);
    els.drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });

    els.main.addEventListener("click", onMainClick);
    $("#lightbox-close").addEventListener("click", closeLightbox);
    $("#lightbox-prev").addEventListener("click", function () { lightboxStep(-1); });
    $("#lightbox-next").addEventListener("click", function () { lightboxStep(1); });
    els.lightbox.addEventListener("click", function (e) {
      if (e.target === els.lightbox) closeLightbox();
    });
    $("#video-player-close").addEventListener("click", closePlayer);
    els.player.addEventListener("click", function (e) {
      if (e.target === els.player) closePlayer();
    });
    if (els.playerVideo && els.playerScrub) {
      els.playerVideo.addEventListener("timeupdate", function () {
        if (els.playerScrub._dragging) return;
        var duration = els.playerVideo.duration;
        if (!duration) return;
        els.playerScrub.value = String(Math.round((els.playerVideo.currentTime / duration) * 1000));
      });
      els.playerScrub.addEventListener("pointerdown", function () {
        els.playerScrub._dragging = true;
      });
      els.playerScrub.addEventListener("pointerup", function () {
        els.playerScrub._dragging = false;
      });
      els.playerScrub.addEventListener("input", function () {
        var duration = els.playerVideo.duration;
        if (!duration) return;
        els.playerVideo.currentTime = (Number(els.playerScrub.value) / 1000) * duration;
      });
    }

    window.addEventListener("hashchange", render);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", function () {
      if (route().name !== "home") return;
      if (document.hidden) {
        state.scanPaused = true;
        clearTimeout(state.scanTimer);
      } else if (!els.lightbox.classList.contains("is-open")) {
        state.scanPaused = false;
        scheduleScanAdvance();
      }
    });
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (!state.scrambling) layoutGrid();
      }).observe(els.main);
    }

    var albumIds = Object.keys(ALBUMS);
    Promise.all(albumIds.map(function (id) {
      return fetch(ALBUMS[id].dataUrl).then(function (res) { return res.json(); });
    }))
      .then(function (results) {
        albumIds.forEach(function (id, i) {
          if (ALBUMS[id].keepOrder) state.albums[id] = results[i];
          else state.albums[id] = shuffleDifferent(results[i], "cv-last-order-" + id);
        });
        render();
      })
      .catch(function () {
        els.main.innerHTML = '<div class="main-wrap"><p>Unable to load photographs. Please serve this site over http rather than opening the file directly.</p></div>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
