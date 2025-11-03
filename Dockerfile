# Usa a imagem oficial do Node.js baseada em Alpine (menor e mais rápida)
FROM node:20-alpine

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia o package.json e package-lock.json (ou yarn.lock)
# Estes são copiados primeiro para aproveitar o cache do Docker (se as dependências não mudarem, a instalação é pulada)
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia o restante dos arquivos (server.js, decks/)
# Isso inclui a pasta 'decks' com todos os seus JSONs, garantindo que o 'fs.readdirSync' funcione
COPY . .

# Expõe a porta que a aplicação Node.js estará ouvindo.
# ATENÇÃO: Em ambientes de cloud como o Render, a porta deve ser definida pela variável de ambiente PORT.
# O 'server.js' já está configurado para usar process.env.PORT || 4000.
# O Render irá injetar a porta que ele exige (geralmente 10000).
EXPOSE 4000

# Comando para rodar a aplicação quando o contêiner for iniciado
# O Render irá executar este comando
CMD [ "node", "server.js" ]

# Instruções para o Build
# 1. Copia package.json
# 2. Roda npm install
# 3. Copia server.js, decks/, etc.
# 4. Inicia o servidor com 'node server.js'