export type Blocker = { x: number; z: number; w: number; d: number }

export type StreetObstacle = Blocker & {
  id: string
  kind: 'bike' | 'ebike' | 'parcels' | 'table' | 'planter'
  material: 'metal' | 'plastic' | 'cardboard' | 'ceramic'
  description: string
  fallRisk: boolean
}

export const STREET_OBSTACLES: StreetObstacle[] = [
  { id: 'shared-bike', kind: 'bike', x: 0, z: 33, w: 1.5, d: 2.3, material: 'metal', description: '一辆横停的共享单车', fallRisk: true },
  { id: 'electric-bike', kind: 'ebike', x: 0.12, z: 24.5, w: 1.25, d: 2.15, material: 'metal', description: '一辆停在盲道上的电动车', fallRisk: true },
  { id: 'delivery-parcels', kind: 'parcels', x: 8.5, z: 7, w: 2.1, d: 1.25, material: 'cardboard', description: '堆在店门外的快递箱', fallRisk: true },
  { id: 'cafe-table', kind: 'table', x: 16.5, z: 7.05, w: 1.8, d: 1.7, material: 'metal', description: '占到盲道上的桌椅', fallRisk: false },
  { id: 'shop-planter', kind: 'planter', x: 25, z: -4.5, w: 1.3, d: 1.3, material: 'ceramic', description: '商铺摆出的花盆', fallRisk: true },
]

export const BLOCKERS: Blocker[] = [
  { x: -52, z: 0, w: 3, d: 116 },
  { x: 52, z: 0, w: 3, d: 116 },
  { x: 0, z: 58, w: 106, d: 3 },
  { x: 0, z: -59, w: 106, d: 3 },
  { x: -28, z: 34, w: 30, d: 18 },
  { x: 28, z: 35, w: 30, d: 20 },
  { x: -30, z: 7, w: 28, d: 26 },
  { x: 37, z: 6, w: 20, d: 26 },
  { x: -30, z: -45, w: 28, d: 18 },
  { x: 39, z: -46, w: 16, d: 19 },
  { x: 25, z: -57, w: 21, d: 5 },
  ...STREET_OBSTACLES.map(({ x, z, w, d }) => ({ x, z, w, d })),
]

export const NPCS = [
  { id: 'helpful', position: [3, 0, 16] as const, label: '询问' },
  { id: 'vague', position: [-10, 0, 5] as const, label: '询问' },
  { id: 'busy', position: [12, 0, -3] as const, label: '询问' },
]

export const PALETTE = {
  black: '#12110F',
  charcoal: '#25221E',
  warm: '#F2EEE5',
  cream: '#E6DCCB',
  wheat: '#C8AD7F',
  camel: '#A78662',
  stone: '#8B8378',
}
