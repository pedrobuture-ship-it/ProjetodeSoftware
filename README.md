# Projeto Terra

Aplicativo offline-first para gerenciamento de uma fazenda de cria de bovinos, com foco em reprodução, inseminação artificial, matrizes, touros, sêmen, partos, manejo sanitário, lotes, relatórios, backup local e sincronização futura com Supabase.

O IndexedDB local é a base principal do sistema. A internet é usada apenas para login, backup/sincronização em nuvem e uso multi-dispositivo.

## Tecnologias

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Dexie.js com IndexedDB
- Supabase Auth e banco online
- PWA instalável
- React Router
- Lucide React
- HTML/CSS/JavaScript modernos, sem APIs externas para backup/relatórios locais

## Instalação

Requisitos:

- Node.js 18 ou superior
- npm

Instale as dependências:

```bash
npm install
```

## Rodar Localmente

```bash
npm run dev
```

Abra o endereço informado pelo Vite, normalmente:

```text
http://localhost:5173
```

O app pode ser usado localmente sem login e sem internet. Os dados ficam salvos no IndexedDB do navegador/dispositivo.

## Build

Para gerar a versão de produção:

```bash
npm run build
```

Os arquivos finais ficam em `dist/`.

## Configuração do .env

Crie um arquivo `.env` na raiz do projeto com base em `.env.example`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
```

Use apenas chaves públicas próprias para frontend.

Importante: nunca coloque a `service_role key` no frontend, no `.env` do Vite, no Vercel ou em qualquer código enviado ao navegador. A `service_role key` ignora RLS e deve existir apenas em ambientes backend seguros.

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Acesse `Project Settings > API`.
3. Copie a URL do projeto para `VITE_SUPABASE_URL`.
4. Copie a chave pública `anon` ou `publishable` para `VITE_SUPABASE_ANON_KEY`.
5. Configure Auth com e-mail/senha em `Authentication > Providers`.
6. Crie as tabelas e políticas RLS usando o SQL do projeto.

## Onde Colar o SQL no Supabase

O SQL completo está em:

```text
supabase/schema.sql
```

No painel do Supabase:

1. Abra o projeto.
2. Vá em `SQL Editor`.
3. Clique em `New query`.
4. Cole todo o conteúdo de `supabase/schema.sql`.
5. Execute a query.

Esse SQL cria tabelas, índices, triggers de `updated_at`, RLS e políticas para que o usuário acesse apenas fazendas das quais é membro.

## Testar Modo Offline

1. Rode o app com `npm run dev`.
2. Abra o app no navegador.
3. Cadastre um animal, lote, sêmen ou manejo.
4. Desative a internet no computador ou use o DevTools do navegador em modo offline.
5. Recarregue o app.
6. Confirme que os dados continuam disponíveis.
7. Cadastre novos dados offline.
8. Volte a ficar online e use a tela `Backup` para sincronização quando houver login e fazenda ativa.

O app não depende do Supabase para os cadastros locais.

## Instalar como PWA

### No computador

1. Gere e publique uma build, ou rode localmente para teste.
2. Abra o app no Chrome, Edge ou navegador compatível.
3. Clique no ícone de instalação na barra de endereço.
4. Escolha `Instalar`.

### No Android

1. Abra a URL do app no Chrome.
2. Toque no menu do navegador.
3. Escolha `Adicionar à tela inicial` ou `Instalar app`.

### No iPhone/iPad

1. Abra a URL do app no Safari.
2. Toque em compartilhar.
3. Escolha `Adicionar à Tela de Início`.

Para instalação PWA em produção, use HTTPS. Em desenvolvimento, `localhost` é aceito pelos navegadores para testes.

## Backup JSON

A tela `Backup` permite:

- Exportar todos os dados locais em JSON.
- Importar um backup JSON.
- Validar o arquivo antes da importação.
- Escolher entre substituir dados locais ou mesclar registros.
- Ver a data do último backup exportado/importado.

Fluxo recomendado:

1. Acesse `Backup`.
2. Clique em `Exportar backup JSON`.
3. Guarde o arquivo em local seguro.
4. Para restaurar, selecione o arquivo JSON.
5. Confira o resumo das tabelas.
6. Escolha `Mesclar` ou `Substituir`.
7. Confirme a importação.

## Sincronização

A sincronização fica na tela `Backup`, no painel `Sincronização Supabase`.

Requisitos para sincronizar:

- App online.
- Supabase configurado no `.env`.
- Usuário logado.
- Fazenda online criada ou selecionada.

Botões disponíveis:

- `Sincronizar agora`: envia pendências locais e baixa dados da nuvem.
- `Enviar dados locais para nuvem`: faz apenas upload.
- `Baixar dados da nuvem`: faz apenas download, com confirmação.
- `Ver última sincronização`: mostra a última sync concluída neste dispositivo.

Regras principais:

- IndexedDB/Dexie continua sendo a base local principal.
- Cada registro guarda `remote_id` quando sincronizado.
- Cada registro sincronizado fica vinculado a uma `farm_id`.
- Conflitos usam a regra de última atualização vence, baseada em `updated_at`.
- Exclusões usam `deleted_at` para soft delete.
- O app local continua funcionando mesmo sem login.

## Deploy no Vercel

1. Suba o projeto para um repositório Git.
2. No Vercel, clique em `Add New Project`.
3. Importe o repositório.
4. Configure:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. Em `Environment Variables`, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Faça o deploy.

Não configure `service_role key` no Vercel para este frontend.

Depois do deploy, use a URL HTTPS gerada pelo Vercel para instalar o PWA em celular e PC.

## Estrutura de Pastas

```text
public/
  icons/                 Ícones PWA
  manifest.webmanifest   Manifesto PWA
  sw.js                  Service worker

src/
  components/            Componentes reutilizáveis
    animals/             Componentes da tela de animais
    auth/                Guardas de autenticação/sync
    layout/              Header, sidebar, menu mobile e shell
    sync/                Painel de sincronização
  constants/             Opções e labels de domínio
  contexts/              AuthContext
  db/                    Dexie e IndexedDB
  layouts/               Layout principal
  lib/                   Cliente Supabase
  pages/                 Telas/rotas do app
  routes/                Definição das rotas
  services/              CRUD, backup, sync, relatórios e regras locais
  types/                 Tipos TypeScript
  utils/                 Datas, formatação, CSV, PDF, validações

supabase/
  schema.sql             SQL completo do banco online
```

## Módulos Implementados

- Dashboard com indicadores e alertas offline.
- Animais: listagem, busca, filtros, cadastro, edição e exclusão lógica.
- Matrizes: status reprodutivo, previsões e histórico.
- Inseminações: cadastro, estoque de sêmen, previsão de diagnóstico e parto.
- Diagnóstico de gestação: resultado e atualização de status da matriz/inseminação.
- Partos: registro e cadastro automático de bezerro vivo.
- Touros/Sêmen: estoque, preço, central, status e alerta de doses baixas.
- Manejo Sanitário: animal ou lote, próxima aplicação, vencidos e próximos.
- Lotes/Piquetes: cadastro, filtros e movimentação de animais.
- Relatórios: exportações CSV e PDFs simples.
- Backup JSON: exportação/importação local.
- Login Supabase Auth: e-mail/senha, cadastro e logout.
- Configurações da fazenda e seleção de fazenda ativa.
- Sincronização Supabase preparada para multi-dispositivo.
- PWA com service worker e manifesto.

## Possíveis Melhorias Futuras

- Testes automatizados com Playwright e Vitest.
- Tela dedicada para fila de sincronização e reprocessamento individual.
- Convites e permissões detalhadas para `farm_members`.
- Estratégias de conflito mais avançadas por campo.
- Relatórios zootécnicos mais completos.
- Controle financeiro de sêmen, medicamentos e vendas.
- Módulo de pesagens e ganho médio diário.
- Manejo por calendário com notificações locais.
- Melhorias de acessibilidade e atalhos para uso no campo.
- Compactação/criptografia opcional de backups JSON.
- Rotina de limpeza de dados de teste e backups antigos.
