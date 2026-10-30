FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-java-common \
    default-jre-headless \
    xvfb \
    xauth \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-dejavu-core \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Try to configure LibreOffice to not require Java if possible
RUN mkdir -p /etc/libreoffice/registry \
  && echo '<?xml version="1.0" encoding="UTF-8"?><oor:component-data xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" oor:name="Common" oor:package="org.openoffice.Office"><node oor:name="Java"><prop oor:name="Enable"><value>false</value></prop></node></oor:component-data>' > /etc/libreoffice/registry/org.openoffice.Office.Common.xcd || true

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]