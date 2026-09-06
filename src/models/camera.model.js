import mongoose from 'mongoose';
import { Schema, Types } from 'mongoose';

const cameraSchema = new mongoose.Schema({
    cameraName: {
        type: String,
        required: true,
        trim: true
    },
    cameraId: {
        type: Schema.Types.ObjectId,
        default: () => new Types.ObjectId(),
        unique: true,
        trim: true
    },
    zona: {
        type: String,
        required: true,
        trim: true
    },
    enderecoRTSP: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('Camera', cameraSchema);