# 哔哩哔哩自动音量

一个用于哔哩哔哩直播间的 Tampermonkey 脚本。

它支持按直播间分别保存音量，并在你再次进入该直播间时自动恢复；未单独配置的直播间会使用默认音量。

## 功能特性

- 直播间独立音量记忆（按房间号保存）
- 默认音量配置（未单独设置时自动使用）
- 自动应用音量（打开直播间后自动恢复）
- 支持超过 100% 的增强音量（最高 300%）
- 油猴菜单入口 + 页面悬浮按钮入口

## 适用环境

- 浏览器扩展：Tampermonkey（油猴）
- 站点：`live.bilibili.com`

## 点击安装

[源码地址（GitHub）](https://github.com/chiriolanus/bilibili-auto-volume-/blob/main/哔哩哔哩直播间音量.user.js)

[![Install from GitHub Raw](https://img.shields.io/badge/Install-GitHub%20Raw-00a1d6?style=for-the-badge)](https://raw.githubusercontent.com/chiriolanus/bilibili-auto-volume-/main/哔哩哔哩直播间音量.user.js)

[![Install from jsDelivr](https://img.shields.io/badge/Install-jsDelivr-f59e0b?style=for-the-badge)](https://cdn.jsdelivr.net/gh/chiriolanus/bilibili-auto-volume-@main/哔哩哔哩直播间音量.user.js)

如果第一个链接无法直接拉起安装，请使用 jsDelivr 按钮。

## 安装方式

1. 安装 Tampermonkey 扩展。
2. 新建脚本，将 `哔哩哔哩直播间音量.user.js` 内容粘贴进去并保存。
3. 打开任意哔哩哔哩直播间页面，确认脚本已启用。

## 使用说明

1. 打开直播间后，点击 Tampermonkey 菜单中的“直播间音量设置”，或点击页面右下角“音量设置”按钮。
2. 在面板中设置“默认音量”或“当前直播间音量”。
3. 点击“保存到当前直播间”，后续进入该直播间会自动恢复该值。
4. 若删除当前直播间配置，会回退到默认音量。

## 关于超过 100% 音量

- 0% 到 100%：使用播放器常规音量。
- 100% 到 300%：通过 Web Audio 增益进行放大。
- 说明：增强音量可能带来失真或爆音，建议循序渐进调整（例如 120% 到 150%）。

## 数据存储

脚本使用 Tampermonkey 的 `GM_setValue`/`GM_getValue` 本地存储配置，包含：

- 默认音量
- 每个直播间房间号对应的音量

## 参考来源与致谢

本脚本在交互设计与脚本组织思路上参考了以下项目：

- AHCorn/Bilibili-Auto-Quality  
  仓库地址：https://github.com/AHCorn/Bilibili-Auto-Quality/



## License

GPL-3.0
