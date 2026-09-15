# WhatsApp Sticker Bot

Um bot simples e open source para transformar imagens, vídeos e GIFs em figurinhas do WhatsApp usando apenas o comando `!fig`.

## Funcionalidades

- Converte imagens em figurinhas WebP.
- Converte vídeos curtos e GIFs em figurinhas animadas.
- Aceita o comando `!fig` tanto na legenda quanto em resposta a uma mídia.
- Exibe o QR Code diretamente no terminal para conectar o WhatsApp.
- Salva a sessão localmente para as próximas execuções.
- Gera figurinhas limpas, sem packname, autor, watermark ou EXIF personalizado.
- Inicia facilmente no Windows com `start.bat`.

## Como funciona

Envie uma imagem, vídeo ou GIF com a legenda:

```text
!fig
```

Ou envie a mídia normalmente, responda a ela com `!fig` e o bot retornará a figurinha no mesmo chat.

Vídeos e GIFs são limitados aos primeiros 10 segundos e otimizados automaticamente para se manterem adequados ao WhatsApp.

## Instalação

### 1. Instale o Node.js

Instale o [Node.js](https://nodejs.org/) **20.9 ou superior**. A versão LTS é recomendada. O FFmpeg usado na conversão animada é instalado automaticamente junto com as dependências; não é necessário instalá-lo à parte.

### 2. Clone o repositório

```bash
git clone URL_DO_REPOSITORIO
cd wa-sticker-bot
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Execute

No Windows, abra o arquivo `start.bat`. Ele instala as dependências caso ainda não existam e inicia o bot.

Também é possível executar pelo terminal:

```bash
npm start
```

### 5. Conecte o WhatsApp

Na primeira execução, o terminal mostrará um QR Code. No WhatsApp, abra **Dispositivos conectados** e escolha conectar um dispositivo para escaneá-lo. Quando aparecer `WhatsApp conectado`, o bot estará pronto.

Enquanto a sessão for válida, as próximas execuções conectam automaticamente. Caso ela seja encerrada, execute novamente para receber um novo QR Code.

## Uso

**Imagem, vídeo ou GIF com legenda:** envie a mídia e use `!fig` como legenda.

**Respondendo uma mídia:**

1. Envie uma imagem, vídeo ou GIF.
2. Responda a essa mídia.
3. Escreva `!fig`.
4. O bot enviará a figurinha.

Se o comando for enviado sem mídia anexada ou respondida, o bot informa como usá-lo. Em caso de falha na conversão, ele envia uma mensagem curta de erro.

## Estrutura

```text
wa-sticker-bot/
├── src/
│   ├── index.js       # conexão, QR Code e comando !fig
│   └── sticker.js     # conversão para WebP
├── auth/              # criado localmente; nunca deve ser enviado ao Git
├── temp/              # arquivos temporários, removidos após conversão
├── start.bat
├── package.json
├── .gitignore
└── LICENSE
```

## Privacidade

Os dados de autenticação são armazenados somente na pasta local `auth/`. Ela contém chaves de sessão do WhatsApp e está no `.gitignore`, portanto não é enviada ao GitHub. Ainda assim, nunca compartilhe essa pasta, seus arquivos ou seu QR Code com outras pessoas.

## Aviso

Este é um projeto independente e não oficial, sem vínculo ou afiliação com WhatsApp ou Meta. Ele usa uma biblioteca não oficial, que pode sofrer alterações ou parar de funcionar caso o WhatsApp mude seus protocolos. Use-o de forma responsável e em conformidade com os termos aplicáveis do WhatsApp.

## Contribuições

Correções, melhorias e pull requests são bem-vindos.

## Licença

Este projeto é distribuído sob a [Licença MIT](LICENSE).

### Gostou do projeto?

Se este projeto te ajudou, considere deixar uma ⭐ no repositório.

Isso ajuda o projeto a alcançar mais pessoas e incentiva novas atualizações.

Obrigado por usar o WhatsApp Sticker Bot!
