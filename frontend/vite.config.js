import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
      vue(),
      viteStaticCopy({
      targets: [
        { src: 'node_modules/tinymce/tinymce.min.js', dest: 'tinymce' },
        { src: 'node_modules/tinymce/icons', dest: 'tinymce' },
        { src: 'node_modules/tinymce/themes', dest: 'tinymce' },
        { src: 'node_modules/tinymce/models', dest: 'tinymce' },
        { src: 'node_modules/tinymce/skins', dest: 'tinymce' },
        { src: 'node_modules/tinymce/plugins', dest: 'tinymce' },
      ],
    }),
  ],
  server: {
    port: 5173,
  },

});
