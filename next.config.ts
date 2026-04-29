import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // 상위 디렉토리(c:\Users\user)에 있는 package-lock.json 때문에 워크스페이스 root가 잘못 잡히는 것 방지
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
