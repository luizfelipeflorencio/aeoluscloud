import {
    PutObjectCommand,
    GetObjectCommand,
    CreateBucketCommand,
    ListBucketsCommand,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import storage from '../config/storage.js';

const bucketName = process.env.MINIO_BUCKET_NAME;
let bucketInitialization;

async function verificarBucketExiste() {
    if (!bucketInitialization) {
        bucketInitialization = (async () => {
            const buckets = await storage.send(new ListBucketsCommand({}));
            const bucketExists = (buckets.Buckets ?? []).some(
                (bucket) => bucket.Name === bucketName
            );

            if (!bucketExists) {
                await criarBucket();
            }
        })();

        try {
            await bucketInitialization;
        } catch (error) {
            bucketInitialization = undefined;
            throw error;
        }
        return;
    }

    await bucketInitialization;
}

async function criarBucket() {
    try {
        await storage.send(
            new CreateBucketCommand({
                Bucket: bucketName,
            })
        );
    } catch (error) {
        if (error.name !== 'BucketAlreadyOwnedByYou') {
            throw error;
        }
    }
}

async function uploadImagem(nomeArquivo, buffer) {
    await verificarBucketExiste();

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
    await verificarBucketExiste();

    const comando = new GetObjectCommand({
        Bucket: bucketName,
        Key: nomeArquivo,
    });

    return getSignedUrl(storage, comando, {
        expiresIn: 300,
    });
}

export {
    criarBucket,
    uploadImagem,
    gerarUrlAssinada,
};
