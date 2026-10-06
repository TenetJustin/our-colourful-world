# Our Colourful World

**Find your way through sound, touch and memory. 用声音、触觉与记忆找到回家的路。**

[Play the live demo](https://way-home-sensory-journey.muncyinshou2025.chatgpt.site/?version=5)

Our Colourful World is a first-person sensory journey about finding your way home when sight is not the main source of information. After an unexpected bus diversion, the player must reconstruct an unfamiliar neighbourhood through spatial sound, a white cane, tactile paving, conversations, smell and memory.

《Our Colourful World》是一段以视障者独立出行为主题的第一人称感官旅程。公交临时改道后，玩家需要依靠空间声音、白杖、盲道、对话、气味与记忆，逐步建立对陌生街区的认知并找到家。

## Core experience / 核心体验

- Begin in darkness; a cane tap briefly reveals nearby forms.
- Navigate with continuous traffic, footsteps, wind and material-specific contact sounds.
- Follow tactile paving while responding to realistic obstructions and hazards.
- Ask passers-by for directions and evaluate incomplete information.
- Use smell as a persistent landmark and build an internal cognitive map.
- Judge when and how to cross a road without a minimap or route arrow.

This project does not attempt to simulate blindness by simply turning the screen black. It explores how games and cities privilege vision, and invites players to perceive space through different kinds of information.

## Run locally / 本地运行

Requirements: Node.js 20 or later.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Controls / 操作

| Input | Action |
| --- | --- |
| `WASD` | Move / 移动 |
| Mouse | Look around / 环顾 |
| `Space` | Tap the white cane / 使用白杖 |
| `E` or `Enter` | Interact / 交互 |
| `Tab` | Cognitive map / 认知地图 |
| `Esc` | Release mouse and pause / 暂停 |

Headphones are recommended because spatial sound is part of the navigation system.

## Technology

- Vite, React and TypeScript
- Three.js, React Three Fiber and Drei
- React Three Rapier
- Zustand
- Web Audio API

