import {
    PutObjectCommand,
    GetObjectCommand,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import storage from '../config/storage.js';

const bucketName = process.env.MINIO_BUCKET_NAME;

async function uploadImagem(nomeArquivo, buffer) {
    const comando = new PutObjectCommand({
        Bucket: bucketName,
        Key: nomeArquivo,
        Body: buffer,
        ContentType: 'image/jpeg',
    });

    await storage.send(comando);
    return nomeArquivo;
}

async function gerarUrlAssinada(nomeArquivo) {
    const comando = new GetObjectCommand({
        Bucket: bucketName,
        Key: nomeArquivo,
    });

    return getSignedUrl(storage, comando, {
        expiresIn: 300,
    });
}

export {
    uploadImagem,
    gerarUrlAssinada,
};
