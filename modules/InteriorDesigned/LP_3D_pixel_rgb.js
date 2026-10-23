/** 俯視／截圖 acceptance 用 RGB 樣本與分類（無 Three 依賴，可單測） */

export const LP_3D_PIXEL_SAMPLE_RGB = {
    floor: { r: 245, g: 240, b: 232 },
    sceneBg: { r: 226, g: 232, b: 240 },
    wall: { r: 148, g: 163, b: 184 },
    wallCap: { r: 51, g: 65, b: 85 },
};

export function colorDistanceRgb(a, b) {
    return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

export function isBgLikeRgb(rgb, samples = LP_3D_PIXEL_SAMPLE_RGB) {
    return colorDistanceRgb(rgb, samples.sceneBg) < 22;
}

export function isWallLikeRgb(rgb, samples = LP_3D_PIXEL_SAMPLE_RGB) {
    const dCap = colorDistanceRgb(rgb, samples.wallCap);
    const dWall = colorDistanceRgb(rgb, samples.wall);
    const dFloor = colorDistanceRgb(rgb, samples.floor);
    const dBg = colorDistanceRgb(rgb, samples.sceneBg);
    const dMinWall = Math.min(dCap, dWall);
    return dCap < 42
        || dWall < 42
        || (dMinWall < 68 && dMinWall + 10 < dBg)
        || (
            dFloor < 62
            && dMinWall < 88
            && dBg > 25
        );
}
