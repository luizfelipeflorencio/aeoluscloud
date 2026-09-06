import 'dotenv/config';
import app from './app.js';
import conectarBanco from './config/database.js';

const PORT = process.env.PORT || 3000;

conectarBanco().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
});