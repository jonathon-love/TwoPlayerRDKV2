FROM node:22

WORKDIR /tmp
COPY  newcastleRDK newcastleRDK
WORKDIR /tmp/newcastleRDK

RUN npm install

EXPOSE 3000
ENTRYPOINT ["/usr/bin/bash", "-c"]
CMD ["npx ts-node server.ts"]