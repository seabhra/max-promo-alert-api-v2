#!/bin/bash

echo "🔧 Corrigindo conflitos no index.html..."

# 1. Resolver conflitos do Git
git checkout --theirs public/index.html

# 2. Remover marcadores de conflito
sed -i '/<<<<<<< HEAD/d' public/index.html
sed -i '/=======/d' public/index.html
sed -i '/>>>>>>> 4f935b1/d' public/index.html

# 3. Extrair CSS para arquivo separado
sed -n '/<style>/,/<\/style>/p' public/index.html | sed '1d;$d' > public/styles.css

# 4. Substituir CSS inline por link externo
sed -i '/<style>/,/<\/style>/c\  <link rel="stylesheet" href="/styles.css">' public/index.html

# 5. Adicionar ao Git
git add public/index.html public/styles.css

echo "✅ Arquivos corrigidos!"
