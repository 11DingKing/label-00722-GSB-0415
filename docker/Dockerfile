# Dockerfile - Electron + Xvfb + noVNC
# 用于在容器中运行和验证桌面应用

FROM node:20-bookworm

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    # X11 虚拟显示
    xvfb \
    # VNC 服务器
    x11vnc \
    # 窗口管理器
    fluxbox \
    # Electron 依赖
    libgtk-3-0 \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    # 字体
    fonts-liberation \
    fonts-noto-cjk \
    # 工具
    curl \
    git \
    procps \
    supervisor \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装 noVNC 和 websockify（使用稳定版本）
RUN git clone --branch v1.4.0 --single-branch https://github.com/novnc/noVNC.git /opt/novnc \
    && git clone --branch v0.11.0 --single-branch https://github.com/novnc/websockify.git /opt/novnc/utils/websockify \
    && ln -s /opt/novnc/vnc.html /opt/novnc/index.html

# 设置工作目录
WORKDIR /app

# 复制 package.json 并安装依赖
COPY package*.json ./
RUN npm install

# 复制源码
COPY . .

# 构建应用（仅前端+Electron源码编译，不打包二进制，容器内直接用 electron . 启动）
RUN npx vue-tsc --noEmit && npx vite build

# 复制 supervisord 配置（Xvfb + Fluxbox + x11vnc + noVNC + Electron）
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 暴露端口：6080=noVNC Web，5900=VNC 原始端口
EXPOSE 5900 6080

# 启动 supervisord，启动成功后日志会输出 "Startup Success!" 及访问地址
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
