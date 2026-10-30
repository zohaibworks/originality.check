FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-draw \
    openjdk-17-jre-headless \
    libreoffice-java-common \
    xvfb \
    xauth \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    ca-certificates \
    procps \
  && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Disable Java in LibreOffice if causing issues
RUN mkdir -p /etc/libreoffice/registry \
  && echo '<?xml version="1.0" encoding="UTF-8"?><oor:component-data xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" oor:name="Common" oor:package="org.openoffice.Office"><node oor:name="Java"><prop oor:name="Enable"><value>true</value></prop><prop oor:name="JRELocations"><value><it>$(JRE_HOME)</it></value></prop></node></oor:component-data>' > /etc/libreoffice/registry/org.openoffice.Office.Common.xcd 2>/dev/null || true

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]