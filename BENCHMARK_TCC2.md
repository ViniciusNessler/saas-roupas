# TCC 2 — Coleta do benchmark (estudo de escala)

Guia para gerar os números finais que vão para a **conclusão** do TCC.

## Decisão de ambiente (registrar na metodologia)

Os dois bancos são avaliados na **mesma máquina virtual, em sequência** (nunca ao mesmo
tempo): ao medir um banco, o container do outro fica **parado**. Isso elimina qualquer
variância de hardware entre os cenários — é um reforço em relação ao texto original ("duas
VMs idênticas"), pois aqui o hardware é **literalmente o mesmo**. Sugestão de nota na
metodologia:

> *"Para eliminar variância de hardware entre os cenários, MySQL e ClickHouse foram avaliados
> na mesma máquina virtual, executados em sequência e nunca simultaneamente (o SGBD ocioso
> permanece desligado durante a medição do outro)."*

## O que é medido

- **4 volumes de vendas:** ~50 mil, 250 mil, 1 milhão e 5 milhões (mesmos dados nos dois bancos, geração determinística).
- **OLAP:** os 6 relatórios.
- **OLTP:** inserção, atualização e deleção unitárias (via aplicação).
- Cada operação: repetida (`REPS`, padrão 10) com aquecimento descartado; usa-se a **mediana**.

---

## 1. Provisionar a VM (Portal Azure)

> ⚠️ Antes: confirme que o **crédito Azure for Students** ainda está válido (Portal → Cost Management).

- **Create a resource → Virtual machine**
- Resource group: `rg-tcc-bench` · Nome: `vm-bench`
- Region: qualquer com disponibilidade (ex.: East US 2) — a mesma nas duas coisas não importa (é 1 VM só)
- Image: **Ubuntu Server 22.04 LTS — x64 Gen2**
- Size: **Standard D2s_v3** (2 vCPU / 8 GB)  ·  Disk: **Standard SSD, 30 GB** (padrão serve)
- Authentication: **SSH public key** · Username: `azureuser` · Inbound: só **SSH (22)**
- **Create** → anote o **IP público**
- Depois de criada: menu **Auto-shutdown** → ativar (ex. 23:00) · **Cost Management → Budgets** → alerta em US$80

> Volume de 5M no D2s_v3 é viável, mas o MySQL fica lento nos scans (é justamente o achado).
> Se quiser mais folga só nesse volume, suba temporariamente para **D4s_v3** (4 vCPU/16 GB).

## 2. Setup (na VM, via SSH)

```bash
ssh -i C:\caminho\vm-bench_key.pem azureuser@<IP>
```
```bash
sudo apt update && sudo apt install -y git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && docker --version
```

Traga o código (SCP do Windows, ou `git clone` se tiver repo):
```powershell
scp -i C:\caminho\vm-bench_key.pem -r "C:\Users\vness\Documents\Claude\saas-roupas" azureuser@<IP>:/home/azureuser/
```

Suba os bancos e instale as dependências:
```bash
cd ~/saas-roupas
# (reprodutibilidade) fixe a versão do ClickHouse no docker-compose.yml em vez de :latest, ex.:
#   image: clickhouse/clickhouse-server:24.8
docker compose up -d           # sobe mysql + clickhouse (com senha senha123)
cd backend && cp .env.example .env && npm install
```

## 3. Teste rápido (valida o pipeline antes do estudo grande)

```bash
cd ~/saas-roupas/backend
VOLUMES="50000" REPS=5 bash scripts/run-study.sh
node scripts/bench-report.js results
```
Deve gerar `results/bench_mysql_50000.jsonl`, `results/bench_clickhouse_50000.jsonl` e `results/resumo.csv`.

## 4. Estudo completo

```bash
cd ~/saas-roupas/backend
bash scripts/run-study.sh          # 50k, 250k, 1M, 5M · MySQL e ClickHouse
node scripts/bench-report.js results
```
- Roda em segundo plano se quiser não prender o terminal:
  `nohup bash scripts/run-study.sh > /tmp/study.log 2>&1 &` e acompanhe com `tail -f /tmp/study.log`.
- OLTP do ClickHouse em 1M/5M é lento (cada update/delete é uma *mutation* que reescreve
  parts) — é o comportamento esperado. Para encurtar, use `REPS=5` no volume de 5M.

## 5. Coletar os resultados (para o Windows) e desligar

```powershell
scp -i C:\caminho\vm-bench_key.pem "azureuser@<IP>:/home/azureuser/saas-roupas/backend/results/*" "C:\Users\vness\Documents\Claude\resultados-tcc2\"
```
Depois **Stop (deallocate)** a VM no Portal para parar de gastar.

## 6. Analisar

O `resumo.csv` tem `volume, db, op, entity, n, mediana_ms`. A partir dele:
- **Tabelas** OLAP e OLTP por volume (MySQL × ClickHouse).
- **Gráficos** tempo × volume (curvas que divergem) por operação — a evidência visual da conclusão.

Me mande o `resumo.csv` que eu monto as tabelas/gráficos e o texto de Resultados/Discussão/Conclusão.
