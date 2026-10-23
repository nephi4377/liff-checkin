/**
 * 櫃體／家具類別與簡化 3D 造型（Three.js mesh group）
 */

/** @typedef {'wardrobe'|'tvCabinet'|'kitchen'|'bed'|'sofa'|'desk'|'bathroom'|'appliance'|'cabinet'|'door'|'window'|'wallSegment'} FixtureDisplayCategory */

export const LP_3D_CATEGORY_COLORS = {
    wardrobe: 0x7c3aed,
    tvCabinet: 0x334155,
    kitchen: 0xea580c,
    bed: 0xfbbf24,
    sofa: 0x65a30d,
    desk: 0x2563eb,
    bathroom: 0x06b6d4,
    appliance: 0x71717a,
    cabinet: 0xb45309,
    door: 0x78350f,
    window: 0x38bdf8,
    wallSegment: 0x475569,
};

/**
 * @param {{ data?: { name?: string, group?: string } }} cab
 * @param {'wallSegment'|'door'|'window'|'cabinet'} kind
 * @returns {FixtureDisplayCategory}
 */
export function resolveFixtureDisplayCategory(cab, kind) {
    if (kind === 'wallSegment') return 'wallSegment';
    if (kind === 'door') return 'door';
    if (kind === 'window') return 'window';
    const name = String(cab?.data?.name || '');
    const group = String(cab?.data?.group || '');
    const hay = `${name} ${group}`;
    if (/衣櫃|衣櫥|衣帽|衣櫃/.test(hay)) return 'wardrobe';
    if (/電視/.test(hay)) return 'tvCabinet';
    if (/沙發/.test(hay)) return 'sofa';
    if (/床/.test(hay) && !/床頭櫃/.test(hay)) return 'bed';
    if (/書桌|辦公桌|餐桌|茶几/.test(hay)) return 'desk';
    if (/廚|中島|流理|爐台|水槽|廚具|廚房/.test(hay)) return 'kitchen';
    if (/馬桶|浴缸|淋浴|洗手台|洗手臺/.test(hay)) return 'bathroom';
    if (/冰箱|洗衣|烘衣|洗碗|微波/.test(hay)) return 'appliance';
    if (/系統櫃|收納|矮櫃|高櫃|櫃/.test(hay)) return 'cabinet';
    return 'cabinet';
}

/**
 * @param {FixtureDisplayCategory} category
 * @param {{ data?: { height?: number } }} cab
 * @param {number} defaultCabinetH
 */
export function resolveFixtureDisplayHeightCm(category, cab, defaultCabinetH) {
    const custom = cab?.data?.height;
    if (custom > 0) return custom;
    switch (category) {
        case 'wardrobe': return 240;
        case 'kitchen': return 90;
        case 'bed': return 45;
        case 'sofa': return 85;
        case 'desk': return 75;
        case 'tvCabinet': return 50;
        case 'bathroom': return 85;
        case 'appliance': return 90;
        default: return defaultCabinetH;
    }
}

function mat(THREE, color, opts = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: opts.roughness ?? 0.72,
        metalness: opts.metalness ?? 0.06,
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
    });
}

function addBox(group, THREE, w, h, d, material, y, zOff = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(0, y + h / 2, zOff);
    group.add(m);
    return m;
}

function addBoxAt(group, THREE, w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y + h / 2, z);
    group.add(m);
    return m;
}

/**
 * @param {typeof import('three')} THREE
 * @param {object} fix — descriptor fixture（含 displayCategory）
 */
export function buildFixtureMeshGroup(THREE, fix) {
    const group = new THREE.Group();
    const cat = fix.displayCategory || 'cabinet';
    const w = fix.widthCm;
    const d = fix.depthCm;
    const h = fix.heightCm;
    const base = fix.baseYCm;

    if (cat === 'door') {
        const frame = mat(THREE, 0x57534e);
        const leaf = mat(THREE, LP_3D_CATEGORY_COLORS.door);
        addBox(group, THREE, w, h, Math.min(d, 4), frame, base, 0);
        addBox(group, THREE, w * 0.92, h * 0.96, Math.max(d * 0.35, 2), leaf, base, 0);
        return group;
    }

    if (cat === 'window') {
        const depth = Math.max(d, 4);
        const sill = mat(THREE, 0xe7e5e4);
        addBoxAt(group, THREE, w, 4, depth, sill, 0, base - 2, 0);
        const glass = mat(THREE, LP_3D_CATEGORY_COLORS.window, {
            roughness: 0.15,
            metalness: 0.2,
            transparent: true,
            opacity: 0.45,
        });
        const glassDepth = Math.max(depth * 0.35, 2);
        addBoxAt(group, THREE, w * 0.9, h * 0.88, glassDepth, glass, 0, base + h * 0.06, 0);
        const frame = mat(THREE, 0x94a3b8);
        const fw = Math.max(2, Math.min(w * 0.08, 8));
        addBoxAt(group, THREE, fw, h, depth, frame, -w / 2 + fw / 2, base, 0);
        addBoxAt(group, THREE, fw, h, depth, frame, w / 2 - fw / 2, base, 0);
        addBoxAt(group, THREE, w, fw, depth, frame, 0, base + h - fw / 2, 0);
        return group;
    }

    if (cat === 'bed') {
        const frameC = mat(THREE, 0x92400e);
        const mattressC = mat(THREE, LP_3D_CATEGORY_COLORS.bed);
        const frameH = Math.min(28, h * 0.45);
        const matH = h - frameH;
        addBox(group, THREE, w, frameH, d, frameC, base);
        addBox(group, THREE, w * 0.96, matH, d * 0.96, mattressC, base + frameH);
        const pillow = mat(THREE, 0xfef9c3);
        addBox(group, THREE, w * 0.22, matH * 0.35, d * 0.18, pillow, base + frameH + matH * 0.55, -d * 0.32);
        return group;
    }

    if (cat === 'sofa') {
        const fabric = mat(THREE, LP_3D_CATEGORY_COLORS.sofa);
        const seatH = h * 0.42;
        const backH = h * 0.58;
        addBox(group, THREE, w, seatH, d * 0.85, fabric, base);
        addBox(group, THREE, w, backH, d * 0.22, fabric, base + seatH * 0.35, -d * 0.36);
        const arm = mat(THREE, 0x4d7c0f);
        addBox(group, THREE, d * 0.18, h * 0.75, d * 0.85, arm, base, -w / 2 + d * 0.09);
        addBox(group, THREE, d * 0.18, h * 0.75, d * 0.85, arm, base, w / 2 - d * 0.09);
        return group;
    }

    if (cat === 'wardrobe') {
        const body = mat(THREE, LP_3D_CATEGORY_COLORS.wardrobe);
        addBox(group, THREE, w, h, d, body, base);
        const door = mat(THREE, 0x5b21b6, { roughness: 0.5 });
        const gap = Math.max(2, w * 0.02);
        const doorW = (w - gap * 3) / 2;
        const leftDoor = addBox(group, THREE, doorW, h * 0.92, 1.5, door, base + h * 0.04, d / 2 - 1);
        leftDoor.position.x = -(doorW / 2 + gap);
        const rightDoor = addBox(group, THREE, doorW, h * 0.92, 1.5, door, base + h * 0.04, d / 2 - 1);
        rightDoor.position.x = doorW / 2 + gap;
        return group;
    }

    if (cat === 'kitchen') {
        const carcass = mat(THREE, 0xf5f5f4);
        const front = mat(THREE, LP_3D_CATEGORY_COLORS.kitchen);
        const top = mat(THREE, 0x78716c, { roughness: 0.35 });
        const bodyH = h * 0.88;
        addBox(group, THREE, w, bodyH, d, carcass, base);
        addBox(group, THREE, w * 0.98, bodyH * 0.96, 2, front, base + bodyH * 0.02, d / 2 - 1);
        addBox(group, THREE, w, 3, d * 1.02, top, base + bodyH);
        return group;
    }

    if (cat === 'tvCabinet') {
        const body = mat(THREE, LP_3D_CATEGORY_COLORS.tvCabinet);
        addBox(group, THREE, w, h, d, body, base);
        const screen = mat(THREE, 0x0f172a, { roughness: 0.2, metalness: 0.3 });
        addBox(group, THREE, w * 0.7, h * 1.6, 3, screen, base + h + h * 0.5, -d * 0.15);
        return group;
    }

    if (cat === 'desk') {
        const top = mat(THREE, 0xd6d3d1);
        const leg = mat(THREE, LP_3D_CATEGORY_COLORS.desk);
        const topH = Math.max(4, h * 0.08);
        addBox(group, THREE, w, topH, d, top, base + h - topH);
        const legW = Math.max(4, w * 0.06);
        const legH = h - topH;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const legMesh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legW), leg);
            legMesh.position.set(sx * (w / 2 - legW), base + legH / 2, sz * (d / 2 - legW));
            group.add(legMesh);
        }
        return group;
    }

    const color = LP_3D_CATEGORY_COLORS[cat] ?? LP_3D_CATEGORY_COLORS.cabinet;
    const body = mat(THREE, color);
    body.emissive = new THREE.Color(color);
    body.emissiveIntensity = 0.12;
    const mesh = addBox(group, THREE, w, h, d, body, base);
    mesh.renderOrder = 2;
    return group;
}

/**
 * @param {typeof import('three')} THREE
 * @param {string} text
 */
/**
 * @param {typeof import('three')} THREE
 * @param {string} text
 * @param {number} [accentHex]
 */
export function createLabelSprite(THREE, text, accentHex = 0xb45309) {
    const label = String(text || '').slice(0, 24);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 30;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    const metrics = ctx.measureText(label);
    const pad = 14;
    canvas.width = Math.ceil(metrics.width + pad * 2);
    canvas.height = fontSize + pad * 2;
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    const accent = `#${(accentHex >>> 0).toString(16).padStart(6, '0')}`;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    const r = 8;
    const w = canvas.width;
    const h = canvas.height;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, pad, fontSize + pad / 2 - 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const matSprite = new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        transparent: true,
        sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(matSprite);
    sprite.scale.set(1, 1, 1);
    sprite.renderOrder = 999;
    sprite.userData.lp3dCabinetLabel = true;
    return sprite;
}
