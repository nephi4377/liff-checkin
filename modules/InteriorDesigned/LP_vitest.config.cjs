const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'node',
        include: [
            'LP_core.test.js',
            'LP_3D_scene.test.js',
            'LP_3D_furniture.test.js',
            'LP_3D_dispose.test.js',
            'LP_3D_snapshot.test.js',
            'LP_3D_walk.test.js',
            'LP_3D_walk_collision.test.js',
            'LP_LayoutPlanner_3d_lazy.test.js',
            'LP_layout_history.test.js',
            'LP_quotation_budgetweb_export.test.js',
            'LP_quote_pricing_rules.test.js',
            'LP_cabinet_quote_lines.test.js',
            'LP_cabinet_quote_filter.test.js',
            'LP_budgetweb_cloud_sync.test.js',
            'LP_budgetweb_firebase_sync.test.js',
            'LP_quote_placement_meta.test.js',
            'LP_migrate_quotation_item_ids.test.js',
            'LP_budget_quote_parser_lib.test.js',
            'LP_tools_commonjs_compat.test.js',
            'LP_budgetweb_import_merge.test.js',
            'LP_preview_hosts.test.js',
            'LP_3DViewer_lifecycle.test.js',
        ],
    },
});
