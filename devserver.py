"""발레75 프로토타입 개발 서버.

정적 파일을 그대로 서빙하되 캐시를 끈다.
브라우저가 ES 모듈을 캐시하면 코드를 고쳐도 이전 화면이 그대로 뜨기 때문이다.
"""

import http.server
import socketserver

PORT = 4175


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):  # 요청 로그는 남기지 않는다
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"발레75 프로토타입 → http://localhost:{PORT}")
        httpd.serve_forever()
