/** 與 LP_LayoutPlanner 共用之純幾何／換算（供單元測試與主程式 import） */

export function cmToFeet(cm) {
    const rawFeet = cm / 30;
    return Math.ceil(rawFeet * 2) / 2;
}

export function getAxes(vertices) {
    const axes = [];
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[i + 1 === vertices.length ? 0 : i + 1];
        const edge = { x: p1.x - p2.x, y: p1.y - p2.y };
        const length = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
        if (length < 1e-9) continue;
        const normal = { x: -edge.y / length, y: edge.x / length };
        axes.push(normal);
    }
    return axes;
}

export function project(vertices, axis) {
    let min = Infinity;
    let max = -Infinity;
    for (const vertex of vertices) {
        const dotProduct = vertex.x * axis.x + vertex.y * axis.y;
        min = Math.min(min, dotProduct);
        max = Math.max(max, dotProduct);
    }
    return { min, max };
}

export function overlap(p1, p2) {
    return p1.max > p2.min + 0.01 && p2.max > p1.min + 0.01;
}
