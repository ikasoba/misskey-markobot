FROM denoland/deno:ubuntu-1.36.4

RUN apt update
RUN apt install mecab libmecab-dev mecab-ipadic-utf8

WORKDIR /bot
COPY main.ts .
COPY deno.json .
COPY .env-example .
COPY src src

RUN deno cache main.ts

CMD deno run -A --unstable main.ts
