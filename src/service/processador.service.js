import axios from 'axios';

const clienteDispositivos = axios.create({
	baseURL: 'http://localhost:3030'
});

export async function verificarSaude() {
	const resposta = await clienteDispositivos.get('/api/health');
	return resposta.data;
}

export async function adicionarDispositivo(deviceId) {
	const resposta = await clienteDispositivos.post('/api/devices', { deviceId });
	return resposta.data;
}

export async function listarDispositivos() {
	const resposta = await clienteDispositivos.get('/api/devices');
	return resposta.data;
}

export async function consultarStatusDispositivo(deviceId) {
	const resposta = await clienteDispositivos.get(`/api/devices/${encodeURIComponent(deviceId)}/status`);
	return resposta.data;
}

export async function removerDispositivo(deviceId) {
	const resposta = await clienteDispositivos.delete(`/api/devices/${encodeURIComponent(deviceId)}`);
	return resposta.data;
}
