import assert from 'node:assert/strict';
import { photoUploadToPreviewUrl, buildOptimisticPhotoLinks } from './photoSavePreview.mjs';

assert.equal(
    photoUploadToPreviewUrl({ type: 'image/jpeg', data: 'abc' }),
    'data:image/jpeg;base64,abc'
);
assert.equal(
    photoUploadToPreviewUrl({ type: 'image/png', data: 'data:image/png;base64,xyz' }),
    'data:image/png;base64,xyz'
);
assert.equal(photoUploadToPreviewUrl('https://drive.example/old'), 'https://drive.example/old');
assert.equal(photoUploadToPreviewUrl(null), '');
assert.equal(photoUploadToPreviewUrl({ type: 'image/jpeg', data: '' }), '');

assert.deepEqual(
    buildOptimisticPhotoLinks(['http://old'], [{ type: 'image/jpeg', data: 'abc' }]),
    ['http://old', 'data:image/jpeg;base64,abc']
);
assert.deepEqual(buildOptimisticPhotoLinks(['http://old'], []), ['http://old']);

console.log('photoSavePreview ok');
