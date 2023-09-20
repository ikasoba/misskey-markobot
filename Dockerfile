FROM denoland/deno:1.36.4

WORKDIR /bot
COPY main.ts .
COPY deno.json .
COPY .env-example .
COPY src src

RUN deno cache main.ts

CMD deno run -A --unstable main.ts
