/** @type {readonly string[]} */
const TEXTURE_KEYS = [
    'map',
    'lightMap',
    'bumpMap',
    'normalMap',
    'specularMap',
    'envMap',
    'alphaMap',
    'aoMap',
    'displacementMap',
    'emissiveMap',
    'metalnessMap',
    'roughnessMap',
];

function collectMaterials(obj, materials, textures) {
    const raw = obj.material;
    if (!raw) return;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const m of list) {
        if (!m) continue;
        materials.add(m);
        for (const key of TEXTURE_KEYS) {
            if (m[key]) textures.add(m[key]);
        }
    }
}

/**
 * 釋放 Object3D 子樹的 geometry / material / texture（共用資源只 dispose 一次）
 * @param {import('three').Object3D | null | undefined} root
 */
export function disposeObject3D(root) {
    if (!root) return;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse((obj) => {
        if (obj.geometry) geometries.add(obj.geometry);
        collectMaterials(obj, materials, textures);
    });
    for (const t of textures) t.dispose();
    for (const m of materials) m.dispose();
    for (const g of geometries) g.dispose();
}

/**
 * @param {import('three').Brush | { geometry?: import('three').BufferGeometry }} brush
 */
export function disposeBrushGeometry(brush) {
    if (brush?.geometry) brush.geometry.dispose();
}
