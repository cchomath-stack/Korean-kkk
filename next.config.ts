import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // 상위 디렉토리(c:\Users\user)에 있는 package-lock.json 때문에 워크스페이스 root가 잘못 잡히는 것 방지
    root: path.resolve(__dirname),
  },
  // mupdf는 /public/mupdf/ 에 둔 정적 파일을 런타임에 dynamic import로 로드함 (번들 우회).
  // 별도 next config 설정 불필요.
};

export default nextConfig;
