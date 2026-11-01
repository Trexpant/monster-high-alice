# Reconhecimento e estimativa de preços

## Publicar

Publique esta pasta na Vercel. As rotas `api/meli` precisam ser executadas como Vercel Functions; GitHub Pages sozinho não executa esse backend.

## Mercado Livre

1. Crie uma aplicação no portal de desenvolvedores do Mercado Livre e cadastre como URL de redirecionamento `https://SEU-DOMINIO/api/meli/callback`.
2. Cadastre na Vercel as variáveis `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET` e `MELI_REDIRECT_URI` (com a mesma URL cadastrada no Mercado Livre).
3. Faça novo deploy e, no app, escolha uma sugestão visual. Ao aparecer a opção, conecte a conta Mercado Livre que será usada para autorizar a consulta.

O segredo fica só na Vercel. A autorização é usada para leitura; o app não cria nem altera anúncios. O token de renovação fica em cookie HttpOnly no navegador e é rotacionado pelo backend em cada consulta. Se o cookie expirar, conecte a conta novamente.

## Limites da estimativa

A foto é analisada no navegador por um modelo visual aberto baixado sob demanda. O primeiro uso precisa de internet e pode levar um tempo; as sugestões são aproximadas e exigem confirmação, pois o modelo não foi treinado especificamente para todas as variantes Monster High. A consulta envia somente o nome confirmado ao backend.

A média usa os preços dos anúncios ativos encontrados para MLB (Brasil), após remover resultados cujo título parece ser apenas de acessórios. É uma média de preços pedidos, não de vendas concluídas ou avaliação profissional. Anúncios incompletos, variantes e resultados fora do padrão ainda podem afetar a estimativa.
