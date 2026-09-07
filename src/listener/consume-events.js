import kafka from "../config/kafka.js";
import { uploadImagem } from "../service/storage.service.js";
import { inserirEvento } from "../service/clickhouse.service.js";

const converterBase64ToImage = (base64String) => {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    return buffer
}

const gerarNomeArquivo = (format) => {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const geradorId = Math.floor(Math.random() * 1000000);
    const uniqueFilename = `${timestamp}_${geradorId}.${format}`
    return uniqueFilename
}

const consumer = kafka.consumer({ groupId: 'test-group' })
await consumer.connect()
await consumer.subscribe({ topic: 'device-events', fromBeginning: false })
await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {

        const eventData = JSON.parse(message.value.toString())
        const imageBuffer = converterBase64ToImage(eventData.image.base64)
        const uniqueFilename = gerarNomeArquivo(eventData.image.format)
        console.log({
            topic,
            partition,
            offset: message.offset,
        })
        uploadImagem(uniqueFilename, imageBuffer)
        inserirEvento(eventData, uniqueFilename)

    },
})