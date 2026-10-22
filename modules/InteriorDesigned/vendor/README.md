# LayoutPlanner 3D vendor

本目錄為 **Three.js** 與 **three-bvh-csg**／**three-mesh-bvh** 的瀏覽器用 ESM 副本（免 CDN）。

更新方式（於 `modules/InteriorDesigned`）：

```bash
npm install three@0.170.0 three-bvh-csg@0.0.16
cp node_modules/three/build/three.module.js vendor/three/build/
cp node_modules/three/examples/jsm/controls/OrbitControls.js vendor/three/examples/jsm/controls/
cp node_modules/three-bvh-csg/build/index.module.js vendor/three-bvh-csg/
cp node_modules/three-mesh-bvh/build/index.module.js vendor/three-mesh-bvh/
```
