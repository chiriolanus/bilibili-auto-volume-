// ==UserScript==
// @name         哔哩哔哩自动音量
// @namespace    https://github.com/chiriolanus/bilibili-auto-volume-
// @version      1.0.1
// @license      GPL-3.0
// @description  为哔哩哔哩直播间按房间单独记忆音量，并在进入直播间时自动应用对应音量或默认音量。
// @author       权哥本人（Chriolanus）
// @icon         https://www.bilibili.com/favicon.ico
// @match        *://live.bilibili.com/*
// @exclude      *://live.bilibili.com/
// @exclude      *://live.bilibili.com/p/*
// @noframes
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
	"use strict";

	const STORAGE_KEY = "bilibili-live-volume-settings";
	const MAX_VOLUME = 300;
	const rootWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
	const DEFAULT_STATE = {
		defaultVolume: 50,
		roomVolumes: {}
	};

	const state = loadState();
	let settingsPanel = null;
	let applyTimer = null;
	let routeObserver = null;
	let lastAppliedRoomId = null;
	let lastAppliedVolume = null;
	let audioContext = null;
	const videoAudioMap = new WeakMap();

	GM_addStyle(`
		#bilibili-live-volume-panel {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: min(92vw, 480px);
			max-height: 86vh;
			overflow: auto;
			display: none;
			z-index: 10000;
			padding: 28px;
			border-radius: 24px;
			background: linear-gradient(135deg, #ffffff, #f7f9fc);
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.16), 0 10px 28px rgba(0, 0, 0, 0.10);
			font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
			color: #2b2f36;
			scrollbar-width: thin;
			scrollbar-color: rgba(0, 161, 214, 0.35) transparent;
		}

		#bilibili-live-volume-panel.show {
			display: block;
			animation: liveVolumeFadeIn 0.24s ease-out, liveVolumeSlideIn 0.24s ease-out;
		}

		#bilibili-live-volume-panel h2 {
			margin: 0 0 10px;
			font-size: 26px;
			line-height: 1.2;
			text-align: center;
			color: #00a1d6;
			letter-spacing: -0.3px;
		}

		#bilibili-live-volume-panel .subtitle {
			margin: 0 0 18px;
			font-size: 13px;
			line-height: 1.5;
			text-align: center;
			color: #667085;
		}

		#bilibili-live-volume-panel .section {
			margin-bottom: 16px;
			padding: 16px;
			border-radius: 18px;
			background: #ffffff;
			border: 1px solid #e5e7eb;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 1px rgba(0, 0, 0, 0.02);
		}

		#bilibili-live-volume-panel .section-title {
			margin: 0 0 12px;
			font-size: 16px;
			font-weight: 700;
			color: #3c4043;
		}

		#bilibili-live-volume-panel .section-desc {
			margin: -6px 0 12px;
			font-size: 12px;
			line-height: 1.45;
			color: #6b7280;
		}

		#bilibili-live-volume-panel .room-id {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			padding: 8px 12px;
			border-radius: 999px;
			background: #eef8fc;
			color: #0085b3;
			font-size: 13px;
			font-weight: 700;
		}

		#bilibili-live-volume-panel .volume-row {
			display: grid;
			grid-template-columns: 1fr 76px;
			gap: 10px;
			align-items: center;
			margin-bottom: 12px;
		}

		#bilibili-live-volume-panel input[type="range"] {
			width: 100%;
			accent-color: #00a1d6;
		}

		#bilibili-live-volume-panel input[type="number"] {
			width: 100%;
			box-sizing: border-box;
			padding: 8px 10px;
			border-radius: 10px;
			border: 1px solid #d7dce3;
			font-size: 14px;
			font-weight: 600;
			color: #2b2f36;
			background: #fff;
		}

		#bilibili-live-volume-panel .actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin-top: 10px;
		}

		#bilibili-live-volume-panel button {
			border: none;
			border-radius: 12px;
			padding: 10px 14px;
			font-size: 14px;
			font-weight: 700;
			cursor: pointer;
			transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
		}

		#bilibili-live-volume-panel button:hover {
			transform: translateY(-1px);
		}

		#bilibili-live-volume-panel button.primary {
			background: #00a1d6;
			color: #ffffff;
			box-shadow: 0 8px 18px rgba(0, 161, 214, 0.22);
		}

		#bilibili-live-volume-panel button.secondary {
			background: #f2f4f7;
			color: #344054;
		}

		#bilibili-live-volume-panel button.danger {
			background: #fff1f5;
			color: #d94667;
		}

		#bilibili-live-volume-panel button:disabled {
			cursor: not-allowed;
			opacity: 0.45;
			transform: none;
			box-shadow: none;
		}

		#bilibili-live-volume-panel .room-list {
			display: grid;
			gap: 10px;
		}

		#bilibili-live-volume-panel .room-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
			padding: 12px 14px;
			border-radius: 14px;
			border: 1px solid #edf0f4;
			background: linear-gradient(180deg, #fff, #fbfcfe);
		}

		#bilibili-live-volume-panel .room-item-main {
			min-width: 0;
		}

		#bilibili-live-volume-panel .room-item-title {
			font-size: 14px;
			font-weight: 700;
			color: #2b2f36;
			word-break: break-all;
		}

		#bilibili-live-volume-panel .room-item-subtitle {
			margin-top: 4px;
			font-size: 12px;
			color: #667085;
		}

		#bilibili-live-volume-panel .room-item-actions {
			display: flex;
			gap: 8px;
			flex-shrink: 0;
		}

		#bilibili-live-volume-panel .empty-state {
			padding: 14px;
			border-radius: 12px;
			background: #f8fafc;
			color: #667085;
			font-size: 13px;
			text-align: center;
		}

		#bilibili-live-volume-panel .footer {
			margin-top: 16px;
			display: flex;
			justify-content: flex-end;
		}

		#bilibili-live-volume-panel .close-button {
			background: #f2f4f7;
			color: #344054;
		}

		@keyframes liveVolumeFadeIn {
			from { opacity: 0; }
			to { opacity: 1; }
		}

		@keyframes liveVolumeSlideIn {
			from { transform: translate(-50%, -58%); }
			to { transform: translate(-50%, -50%); }
		}

		@media (max-width: 480px) {
			#bilibili-live-volume-panel {
				width: 94vw;
				padding: 20px;
			}

			#bilibili-live-volume-panel h2 {
				font-size: 22px;
			}

			#bilibili-live-volume-panel .volume-row {
				grid-template-columns: 1fr 70px;
			}

			#bilibili-live-volume-panel .room-item {
				flex-direction: column;
				align-items: stretch;
			}

			#bilibili-live-volume-panel .room-item-actions {
				justify-content: flex-end;
			}
		}
	`);

	function loadState() {
		const raw = GM_getValue(STORAGE_KEY, DEFAULT_STATE);
		const parsed = typeof raw === "string" ? safeParse(raw) : raw;
		return normalizeState(parsed);
	}

	function safeParse(text) {
		try {
			return JSON.parse(text);
		} catch (error) {
			return null;
		}
	}

	function normalizeState(raw) {
		const next = {
			defaultVolume: 50,
			roomVolumes: {}
		};

		if (raw && typeof raw === "object") {
			const defaultVolume = Number(raw.defaultVolume);
			if (Number.isFinite(defaultVolume)) {
				next.defaultVolume = clampVolume(defaultVolume);
			}

			if (raw.roomVolumes && typeof raw.roomVolumes === "object") {
				Object.entries(raw.roomVolumes).forEach(([roomId, volume]) => {
					const normalizedRoomId = String(roomId).trim();
					const normalizedVolume = Number(volume);
					if (normalizedRoomId && Number.isFinite(normalizedVolume)) {
						next.roomVolumes[normalizedRoomId] = clampVolume(normalizedVolume);
					}
				});
			}
		}

		return next;
	}

	function saveState() {
		GM_setValue(STORAGE_KEY, {
			defaultVolume: state.defaultVolume,
			roomVolumes: state.roomVolumes
		});
	}

	function clampVolume(value) {
		const number = Number(value);
		if (!Number.isFinite(number)) {
			return 0;
		}
		return Math.min(MAX_VOLUME, Math.max(0, Math.round(number)));
	}

	function getCurrentRoomId() {
		const pathnameMatch = location.pathname.match(/^\/(\d+)(?:\b|\/|$)/);
		if (pathnameMatch) {
			return pathnameMatch[1];
		}

		const searchRoomId = new URLSearchParams(location.search).get("room_id");
		if (searchRoomId && /^\d+$/.test(searchRoomId)) {
			return searchRoomId;
		}

		const waifu = rootWindow.__NEPTUNE_IS_MY_WAIFU__;
		const candidates = [
			waifu && waifu.roomInitRes && waifu.roomInitRes.data && waifu.roomInitRes.data.room_id,
			waifu && waifu.roomInfo && waifu.roomInfo.room_id,
			waifu && waifu.room_id,
			rootWindow.__room_id,
			rootWindow.room_id
		];

		for (const candidate of candidates) {
			if (candidate == null) {
				continue;
			}
			const normalized = String(candidate).trim();
			if (/^\d+$/.test(normalized)) {
				return normalized;
			}
		}

		return null;
	}

	function getTargetVolume(roomId) {
		if (roomId && Object.prototype.hasOwnProperty.call(state.roomVolumes, roomId)) {
			return clampVolume(state.roomVolumes[roomId]);
		}
		return clampVolume(state.defaultVolume);
	}

	function getVideoElements() {
		return Array.from(document.querySelectorAll("video"));
	}

	function setVideoVolume(video, volume) {
		const target = clampVolume(volume);
		const normalized = Math.min(1, target / 100);
		try {
			video.volume = normalized;
			video.muted = target === 0;
			applyVideoBoost(video, target);
			return true;
		} catch (error) {
			return false;
		}
	}

	function getAudioContext() {
		if (audioContext) {
			return audioContext;
		}

		const Ctx = window.AudioContext || window.webkitAudioContext;
		if (!Ctx) {
			return null;
		}

		try {
			audioContext = new Ctx();
			return audioContext;
		} catch (error) {
			return null;
		}
	}

	function ensureVideoAudioNodes(video) {
		if (videoAudioMap.has(video)) {
			return videoAudioMap.get(video);
		}

		const ctx = getAudioContext();
		if (!ctx) {
			return null;
		}

		try {
			const source = ctx.createMediaElementSource(video);
			const gainNode = ctx.createGain();
			source.connect(gainNode);
			gainNode.connect(ctx.destination);
			const nodes = { gainNode };
			videoAudioMap.set(video, nodes);
			return nodes;
		} catch (error) {
			return null;
		}
	}

	function applyVideoBoost(video, volumePercent) {
		const nodes = ensureVideoAudioNodes(video);
		if (!nodes) {
			return;
		}

		const ctx = getAudioContext();
		if (ctx && ctx.state === "suspended") {
			ctx.resume().catch(() => {});
		}

		const target = clampVolume(volumePercent);
		nodes.gainNode.gain.value = Math.max(1, target / 100);
	}

	function detectPlayerVolumeScale(player) {
		if (!player || typeof player.getVolume !== "function") {
			return null;
		}

		try {
			const value = Number(player.getVolume());
			if (!Number.isFinite(value)) {
				return null;
			}
			return value > 1 ? "0-100" : "0-1";
		} catch (error) {
			return null;
		}
	}

	function setPlayerApiVolume(player, volumePercent) {
		if (!player || typeof player.setVolume !== "function") {
			return false;
		}

		if (clampVolume(volumePercent) > 100) {
			return false;
		}

		const normalized = clampVolume(volumePercent) / 100;
		const scale = detectPlayerVolumeScale(player);
		if (!scale) {
			return false;
		}

		const candidates = scale === "0-100" ? [clampVolume(volumePercent)] : [normalized];

		for (const value of candidates) {
			try {
				player.setVolume(value);
				return true;
			} catch (error) {
				void error;
			}
		}

		return false;
	}

	function setPlayerVolume(volume) {
		const videos = getVideoElements();
		let applied = false;

		videos.forEach(video => {
			applied = setVideoVolume(video, volume) || applied;
		});

		const livePlayer = rootWindow.livePlayer;
		const candidatePlayers = [
			livePlayer,
			livePlayer && livePlayer.player,
			rootWindow.player
		].filter(Boolean);

		candidatePlayers.forEach(player => {
			applied = setPlayerApiVolume(player, volume) || applied;
		});

		return applied || videos.length > 0;
	}

	function applyVolume(force = false) {
		const roomId = getCurrentRoomId();
		if (!roomId) {
			return false;
		}

		const targetVolume = getTargetVolume(roomId);
		if (!force && lastAppliedRoomId === roomId && lastAppliedVolume === targetVolume) {
			return true;
		}

		const applied = setPlayerVolume(targetVolume);
		if (applied) {
			lastAppliedRoomId = roomId;
			lastAppliedVolume = targetVolume;
			console.log(`[直播间音量] 已应用房间 ${roomId} 的音量: ${targetVolume}%`);
		}
		return applied;
	}

	function scheduleApply(force = false) {
		clearTimeout(applyTimer);
		applyTimer = setTimeout(() => {
			applyTimer = null;
			if (!applyVolume(force)) {
				scheduleApply(force);
			}
		}, 500);
	}

	function ensureBodyReady(callback) {
		if (document.body) {
			callback();
			return;
		}

		document.addEventListener("DOMContentLoaded", callback, { once: true });
	}

	function buildPanel() {
		const panel = document.createElement("div");
		panel.id = "bilibili-live-volume-panel";
		panel.innerHTML = `
			<h2>直播间音量</h2>
			<div class="subtitle">为每个直播间单独保存音量，未设置的直播间会自动使用默认音量。支持最高 ${MAX_VOLUME}%（100%以上为增强音量）。</div>

			<div class="section">
				<div class="section-title">默认音量</div>
				<div class="section-desc">当当前直播间没有单独设置时，脚本会自动使用这里的默认值（范围 0-${MAX_VOLUME}%）。</div>
				<div class="volume-row">
					<input id="default-volume-range" type="range" min="0" max="${MAX_VOLUME}" step="1" value="${state.defaultVolume}">
					<input id="default-volume-number" type="number" min="0" max="${MAX_VOLUME}" step="1" value="${state.defaultVolume}">
				</div>
			</div>

			<div class="section">
				<div class="section-title">当前直播间</div>
				<div class="room-id">房间号：<span id="current-room-id">${getCurrentRoomId() || "未识别"}</span></div>
				<div class="section-desc">可以先调整预览值，再保存到当前直播间；删除后会回退到默认音量（范围 0-${MAX_VOLUME}%）。</div>
				<div class="volume-row">
					<input id="room-volume-range" type="range" min="0" max="${MAX_VOLUME}" step="1" value="${getTargetVolume(getCurrentRoomId())}">
					<input id="room-volume-number" type="number" min="0" max="${MAX_VOLUME}" step="1" value="${getTargetVolume(getCurrentRoomId())}">
				</div>
				<div class="actions">
					<button class="primary" id="save-room-volume">保存到当前直播间</button>
					<button class="secondary" id="apply-room-volume">立即应用预览值</button>
					<button class="danger" id="delete-room-volume">删除当前设置</button>
				</div>
			</div>

			<div class="section">
				<div class="section-title">已保存的直播间</div>
				<div id="room-list" class="room-list"></div>
			</div>

			<div class="footer">
				<button class="close-button" id="close-panel">关闭</button>
			</div>
		`;

		panel.addEventListener("input", event => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) {
				return;
			}

			if (target.id === "default-volume-range" || target.id === "default-volume-number") {
				syncVolumeInputs(panel, "default", target.value);
				state.defaultVolume = clampVolume(target.value);
				saveState();
				updateRoomList(panel);

				const currentRoomId = getCurrentRoomId();
				if (!currentRoomId || !Object.prototype.hasOwnProperty.call(state.roomVolumes, currentRoomId)) {
					scheduleApply(true);
				}
			}

			if (target.id === "room-volume-range" || target.id === "room-volume-number") {
				syncVolumeInputs(panel, "room", target.value);
			}
		});

		panel.addEventListener("change", event => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) {
				return;
			}

			if (target.id === "default-volume-range" || target.id === "default-volume-number") {
				state.defaultVolume = clampVolume(target.value);
				saveState();
				updateRoomList(panel);
			}

			if (target.id === "room-volume-range" || target.id === "room-volume-number") {
				syncVolumeInputs(panel, "room", target.value);
			}
		});

		panel.addEventListener("click", event => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) {
				return;
			}

			const currentRoomId = getCurrentRoomId();

			if (target.id === "save-room-volume") {
				if (!currentRoomId) {
					return;
				}
				const roomVolume = getPanelVolume(panel, "room");
				state.roomVolumes[currentRoomId] = roomVolume;
				saveState();
				updateRoomList(panel);
				scheduleApply(true);
				return;
			}

			if (target.id === "apply-room-volume") {
				if (!currentRoomId) {
					return;
				}
				const roomVolume = getPanelVolume(panel, "room");
				setPlayerVolume(roomVolume);
				lastAppliedRoomId = currentRoomId;
				lastAppliedVolume = roomVolume;
				return;
			}

			if (target.id === "delete-room-volume") {
				if (!currentRoomId || !Object.prototype.hasOwnProperty.call(state.roomVolumes, currentRoomId)) {
					return;
				}
				delete state.roomVolumes[currentRoomId];
				saveState();
				updateRoomList(panel);
				syncVolumeInputs(panel, "room", getTargetVolume(currentRoomId));
				scheduleApply(true);
				return;
			}

			if (target.id === "close-panel") {
				togglePanel(false);
				return;
			}

			if (target.dataset && target.dataset.action === "apply-room") {
				const roomId = target.dataset.roomId;
				const roomVolume = state.roomVolumes[roomId];
				if (roomId && Number.isFinite(Number(roomVolume))) {
					setPlayerVolume(roomVolume);
					lastAppliedRoomId = roomId;
					lastAppliedVolume = clampVolume(roomVolume);
				}
				return;
			}

			if (target.dataset && target.dataset.action === "delete-room") {
				const roomId = target.dataset.roomId;
				if (roomId && Object.prototype.hasOwnProperty.call(state.roomVolumes, roomId)) {
					delete state.roomVolumes[roomId];
					saveState();
					updateRoomList(panel);
					if (roomId === currentRoomId) {
						scheduleApply(true);
						syncVolumeInputs(panel, "room", getTargetVolume(currentRoomId));
					}
				}
			}
		});

		document.body.appendChild(panel);
		return panel;
	}

	function syncVolumeInputs(panel, scope, value) {
		const volume = clampVolume(value);
		const range = panel.querySelector(scope === "default" ? "#default-volume-range" : "#room-volume-range");
		const number = panel.querySelector(scope === "default" ? "#default-volume-number" : "#room-volume-number");

		if (range) {
			range.value = String(volume);
		}
		if (number) {
			number.value = String(volume);
		}
	}

	function getPanelVolume(panel, scope) {
		const input = panel.querySelector(scope === "default" ? "#default-volume-number" : "#room-volume-number");
		return clampVolume(input ? input.value : 0);
	}

	function updateRoomList(panel) {
		const list = panel.querySelector("#room-list");
		if (!list) {
			return;
		}

		const entries = Object.entries(state.roomVolumes)
			.filter(([, volume]) => Number.isFinite(Number(volume)))
			.sort((a, b) => Number(b[0]) - Number(a[0]));

		if (entries.length === 0) {
			list.innerHTML = '<div class="empty-state">还没有保存任何直播间设置。</div>';
			return;
		}

		list.innerHTML = entries.map(([roomId, volume]) => `
			<div class="room-item">
				<div class="room-item-main">
					<div class="room-item-title">房间 ${roomId}</div>
					<div class="room-item-subtitle">保存音量：${clampVolume(volume)}%</div>
				</div>
				<div class="room-item-actions">
					<button class="secondary" data-action="apply-room" data-room-id="${roomId}">应用</button>
					<button class="danger" data-action="delete-room" data-room-id="${roomId}">删除</button>
				</div>
			</div>
		`).join("");
	}

	function updatePanel(panel = settingsPanel) {
		if (!panel) {
			return;
		}

		const roomId = getCurrentRoomId();
		const roomIdText = panel.querySelector("#current-room-id");
		if (roomIdText) {
			roomIdText.textContent = roomId || "未识别";
		}

		const roomVolume = roomId ? getTargetVolume(roomId) : state.defaultVolume;
		syncVolumeInputs(panel, "default", state.defaultVolume);
		syncVolumeInputs(panel, "room", roomVolume);
		updateRoomList(panel);
	}

	function togglePanel(forceShow) {
		ensureBodyReady(() => {
			if (!settingsPanel) {
				settingsPanel = buildPanel();
			}

			if (typeof forceShow === "boolean") {
				settingsPanel.classList.toggle("show", forceShow);
			} else {
				settingsPanel.classList.toggle("show");
			}

			if (settingsPanel.classList.contains("show")) {
				updatePanel(settingsPanel);
			}
		});
	}

	function installRouteHook() {
		const history = window.history;
		if (!history || history.__liveVolumeHooked) {
			return;
		}

		history.__liveVolumeHooked = true;

		const pushState = history.pushState;
		const replaceState = history.replaceState;

		history.pushState = function () {
			const result = pushState.apply(this, arguments);
			window.dispatchEvent(new Event("locationchange"));
			return result;
		};

		history.replaceState = function () {
			const result = replaceState.apply(this, arguments);
			window.dispatchEvent(new Event("locationchange"));
			return result;
		};

		window.addEventListener("popstate", () => window.dispatchEvent(new Event("locationchange")));
		window.addEventListener("hashchange", () => window.dispatchEvent(new Event("locationchange")));
		window.addEventListener("locationchange", () => {
			scheduleApply(true);
			if (settingsPanel && settingsPanel.classList.contains("show")) {
				updatePanel(settingsPanel);
			}
		});
	}

	function startObserver() {
		if (routeObserver || !document.body) {
			return;
		}

		routeObserver = new MutationObserver(() => {
			scheduleApply(false);
		});
		routeObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	function registerMenuCommands() {
		if (typeof GM_registerMenuCommand !== "function") {
			return;
		}

		GM_registerMenuCommand("直播间音量设置", () => togglePanel(true));
		GM_registerMenuCommand("刷新当前直播间音量", () => scheduleApply(true));
	}

	function ensureFloatingButton() {
		ensureBodyReady(() => {
			if (document.getElementById("bilibili-live-volume-fab")) {
				return;
			}

			const button = document.createElement("button");
			button.id = "bilibili-live-volume-fab";
			button.type = "button";
			button.textContent = "音量设置";
			button.style.cssText = [
				"position:fixed",
				"right:16px",
				"bottom:16px",
				"z-index:10000",
				"padding:10px 14px",
				"border:none",
				"border-radius:999px",
				"background:#00a1d6",
				"color:#fff",
				"font-size:14px",
				"font-weight:700",
				"cursor:pointer",
				"box-shadow:0 10px 24px rgba(0,161,214,.26)"
			].join(";");
			button.addEventListener("click", () => togglePanel(true));
			document.body.appendChild(button);
		});
	}

	registerMenuCommands();

	function boot() {
		installRouteHook();
		startObserver();
		scheduleApply(true);
		ensureFloatingButton();

		window.addEventListener("pointerdown", () => {
			const ctx = getAudioContext();
			if (ctx && ctx.state === "suspended") {
				ctx.resume().catch(() => {});
			}
		}, { once: true, passive: true });

		ensureBodyReady(() => {
			document.body.addEventListener("click", event => {
				const target = event.target;
				if (!(target instanceof HTMLElement)) {
					return;
				}

				if (settingsPanel && settingsPanel.classList.contains("show") && !settingsPanel.contains(target)) {
					const clickInsidePanel = target.closest("#bilibili-live-volume-panel");
					if (!clickInsidePanel) {
						settingsPanel.classList.remove("show");
					}
				}
			});
		});

		const initialRetry = setInterval(() => {
			if (applyVolume(false)) {
				clearInterval(initialRetry);
			}
		}, 1500);

		window.addEventListener("beforeunload", () => {
			clearInterval(initialRetry);
			clearTimeout(applyTimer);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot, { once: true });
	} else {
		boot();
	}
})();
