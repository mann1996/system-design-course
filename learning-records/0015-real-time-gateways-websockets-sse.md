# Learning Record 0015: Real-Time Gateways, WebSockets, SSE & Connection Scaling

- **Learner Context**: Experienced developer strengthening staff-level distributed system design Conviction.
- **Topic**: Real-time communication protocols, C1000K concurrency limits, operating system socket tuning, and connection draining.

## Core Conceptual Breakthroughs

1. **Protocol Selection Discipline: WebSockets vs. SSE**:
   - WebSockets (RFC 6455) are bidirectional full-duplex TCP streams with tiny framing overhead (2–14 bytes), essential for interactive chat, gaming, and collaborative editing.
   - If communication is strictly unidirectional server-to-client (e.g. LLM token streaming, financial ticker prices, sports scores), Server-Sent Events (SSE) over HTTP/2 is architecturally superior: multiplexes multiple streams over single TCP connections, supports native browser reconnection (`Last-Event-ID`), and traverses standard CDNs and corporate proxies without custom firewall rules.

2. **The C1000K Hardware & Kernel Boundaries**:
   - *File Descriptors (`nofile`)*: Every socket is a file descriptor in Linux. Default `ulimit -n 1024` crashes immediately upon connection 1025 (`EMFILE: too many open files`). Production requires tuning `fs.file-max` and process limits to 1M+.
   - *Kernel Socket Buffers (`tcp_rmem` / `tcp_wmem`)*: Linux defaults allocate 128KB–256KB per socket. For 500,000 connections, default buffers demand 128 GB of pure kernel RAM! Tuning minimum buffers to 4KB–16KB allows high-density socket packing.
   - *Ephemeral Port Exhaustion*: Outbound connections to upstream proxies are bound by the 65,535 limit on the 4-tuple `(src_ip, src_port, dst_ip, dst_port)`.
   - *V8 Heap Memory*: Each `ws` WebSocket in Node.js holds EventEmitters and session metadata (~6KB–10KB/socket). Packing >80k sockets per Node process triggers catastrophic GC pause freezes.

3. **Ingress Architecture: L4 NLB over L7 ALB**:
   - Layer 7 ALBs terminate and re-buffer TCP connections, incurring steep Load Balancer Capacity Unit (LCU) hourly charges per active connection minute and enforcing 60s idle timeouts.
   - Layer 4 Network Load Balancers (AWS NLB) route raw TCP packets with sub-millisecond latency, zero per-connection buffering, and massive horizontal scaling.

4. **Rolling Deployments & The Reconnection Stampede**:
   - Abruptly terminating a gateway pod holding 100,000 connections triggers a simultaneous reconnect storm. Thousands of cryptographic TLS handshakes lock up surviving pods' CPUs at 100%, causing a cascading domino outage.
   - Guardrail: Intercept `SIGTERM`, fail readiness probes to stop new ingress, and drain active sockets gradually (e.g., 200 sockets/sec) using WebSocket Close Frame `1001 Going Away`, while clients apply exponential backoff with Full Jitter.
