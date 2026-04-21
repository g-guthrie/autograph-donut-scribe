FROM debian:trixie-slim AS addons

RUN dpkg --add-architecture i386
RUN apt update && apt upgrade -y && \
    apt install -y --no-install-recommends \
    ca-certificates curl patchelf

ENV PKG_CONFIG_PATH=/usr/lib/i386-linux-gnu/pkgconfig

WORKDIR /xash

ARG METAMOD_VERSION="1.21p37-xash3d-git2"
ARG METAMOD_FILENAME="metamod-$METAMOD_VERSION-linux.tar.gz"
ARG METAMOD_URL_BASE="https://github.com/ludufre/metamod-p/releases/download/v$METAMOD_VERSION"
ARG METAMOD_SHA256="a9cb141395b61d16996a90137ae4945054460cf3cc5ed272aff4f44e87a75259"

ARG AMXMODX_VERSION="1.9.0-git5302-xash-git2"
ARG AMXMODX_FILENAME="amxmodx-$AMXMODX_VERSION-base-linux-gcc.tar.gz"
ARG AMXMODX_FILENAME_CSTRIKE="amxmodx-$AMXMODX_VERSION-cstrike-linux-gcc.tar.gz"
ARG AMXMODX_SHA256="75109e227a14434574e1d3aa5faab62bf8ead51ae02823208fde46d6e3434037"
ARG AMXMODX_SHA256_CSTRIKE="9c0005134498249eea7d3627fa161a0c0c47c80a2ecdb7c45be99d152c85c76c"
ARG AMXMODX_URL_BASE="https://github.com/ludufre/amxmodx/releases/download/v$AMXMODX_VERSION"

RUN mkdir -p /opt/xash/xashds/cstrike/

RUN curl -sLO "$METAMOD_URL_BASE/$METAMOD_FILENAME" \
    && echo "$METAMOD_SHA256  $METAMOD_FILENAME" | sha256sum -c - \
    && tar -C /opt/xash/xashds/cstrike/ -zxvf "$METAMOD_FILENAME"

RUN curl -sLO "$AMXMODX_URL_BASE/$AMXMODX_FILENAME" \
    && echo "$AMXMODX_SHA256  $AMXMODX_FILENAME" | sha256sum -c - \
    && tar -C /opt/xash/xashds/cstrike/ -zxvf "$AMXMODX_FILENAME" \
    && echo 'linux addons/amxmodx/dlls/amxmodx_mm_i386.so' >> /opt/xash/xashds/cstrike/addons/metamod/plugins.ini \
    && rm -f "$AMXMODX_FILENAME" \
    && patchelf --clear-execstack /opt/xash/xashds/cstrike/addons/amxmodx/dlls/amxmodx_mm_i386.so

RUN curl -sLO "$AMXMODX_URL_BASE/$AMXMODX_FILENAME_CSTRIKE" \
    && echo "$AMXMODX_SHA256_CSTRIKE  $AMXMODX_FILENAME_CSTRIKE" | sha256sum -c - \
    && tar -C /opt/xash/xashds/cstrike/ -zxvf "$AMXMODX_FILENAME_CSTRIKE" \
    && rm -f "$AMXMODX_FILENAME_CSTRIKE"

FROM yohimik/cs-web-server:latest AS server

COPY --from=addons "/opt/xash/xashds/cstrike" cstrike
USER root
RUN sed -i 's/dlls\/cs\.so/addons\/metamod\/dlls\/metamod.so/g' cstrike/liblist.gam
RUN cat cstrike/mapcycle.txt >> cstrike/addons/amxmodx/configs/maps.ini
USER xashds

WORKDIR /xashds
