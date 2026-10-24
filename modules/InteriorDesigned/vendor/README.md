# LayoutPlanner 3D vendor

本目錄為 **Three.js** 與 **three-bvh-csg**／**three-mesh-bvh** 的瀏覽器用 ESM 副本（免 CDN）。

| 套件 | 版本 | 授權檔 |
|------|------|--------|
| three | 0.170.0 | [LICENSE-three](./LICENSE-three) |
| three-bvh-csg | 0.0.16 | [LICENSE-three-bvh-csg](./LICENSE-three-bvh-csg) |
| three-mesh-bvh | **0.9.16** | [LICENSE-three-mesh-bvh](./LICENSE-three-mesh-bvh) |
| pdfjs-dist | 4.4.168 | [pdfjs-dist/LICENSE](./pdfjs-dist/LICENSE) |

`LP_LayoutPlanner.js` 僅在使用者按下「3D 檢視」時才 `import('./LP_3DViewer.js')`；vendor 載入失敗時平面編輯不受影響。

更新方式（於 `modules/InteriorDesigned`）：

```bash
npm install three@0.170.0 three-bvh-csg@0.0.16
cp node_modules/three/build/three.module.js vendor/three/build/
cp node_modules/three/examples/jsm/controls/OrbitControls.js vendor/three/examples/jsm/controls/
cp node_modules/three-bvh-csg/build/index.module.js vendor/three-bvh-csg/
cp node_modules/three-mesh-bvh/build/index.module.js vendor/three-mesh-bvh/
cp node_modules/three/LICENSE vendor/LICENSE-three
cp node_modules/three-bvh-csg/LICENSE vendor/LICENSE-three-bvh-csg
cp node_modules/three-mesh-bvh/LICENSE vendor/LICENSE-three-mesh-bvh
```
