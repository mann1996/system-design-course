# Learning Record 0020: Multi-Region Architecture, Anycast Ingress & Split-Brain Prevention

- **Learner Context**: Senior-track engineer mastering planetary multi-region distributed systems, cross-continental data consistency, and disaster recovery.
- **Topic**: Active-Passive vs Active-Active multi-primary architectures, Anycast BGP vs Latency-Based GeoDNS routing, User Home Region Affinity partitioning, Last-Write-Wins (LWW) clock drift corruption, Conflict-free Replicated Data Types (CRDTs), and N+1 regional evacuation headroom.

## Core Conceptual Breakthroughs

1. **The Multi-Region Dual Mandate: Disaster Recovery & Speed of Light**:
   - Single-region architectures fail catastrophically during cloud provider control-plane outages or localized physical disasters (RTO hours, RPO data loss).
   - Speed-of-light propagation across continental glass fibers dictates a mandatory $75 \text{ ms}$ transatlantic RTT and $145 \text{ ms}$ transpacific RTT. Multi-region presence is physically mandatory to deliver sub-50ms p99 APIs to global users.

2. **Global Ingress: Anycast BGP vs GeoDNS**:
   - *GeoDNS*: Resolves client hostnames based on resolver IP. Flexible weighted routing dials, but client and ISP recursive resolvers violate low TTLs, delaying traffic shifts by 15&ndash;45 minutes during an emergency.
   - *Anycast BGP*: Multiple regional datacenters broadcast the exact same IP address to Tier-1 internet backbones. Internet routers naturally direct traffic along shortest AS-path hops. Failover occurs in seconds via BGP route withdrawal with zero reliance on client DNS caching.

3. **Multi-Region Data Topologies: The Consistency Spectrum**:
   - *Active-Passive (Warm Standby)*: Single global write master; read replicas in other regions. Zero write conflicts, but high write latency for international users and non-zero RPO during failovers.
   - *Active-Active with User Home Region Affinity (Recommended)*: Users are partitioned to a Home Region (e.g. EU users &rarr; `eu-west-1`). Local writes commit in 5ms synchronously with zero cross-region write conflicts. Traveling users have their writes proxied back to their Home Region.
   - *Active-Active Multi-Primary*: Any region writes to any record, delivering ultra-low write latency but introducing concurrent write conflicts.

4. **Conflict Resolution: LWW Clock Drift vs CRDT PN-Counters**:
   - *The Last-Write-Wins (LWW) Trap*: Using server wall-clock timestamps ($t_1$ vs $t_2$) to arbitrate concurrent writes causes silent data corruption due to NTP server clock skew ($50\text{--}250 \text{ ms}$). An older write on a fast clock overwrites a true newer write on a slower clock.
   - *CRDTs (Conflict-free Replicated Data Types)*: State-based PN-Counters track positive ($P$) and negative ($N$) mutation vectors per region. Operations are mathematically commutative ($A \star B = B \star A$), associative, and idempotent, ensuring all regions converge to the exact same value without data loss or distributed locks.

5. **Disaster Recovery: Regional Evacuation & The N+1 Capacity Law**:
   - *Split-Brain Prevention*: In a network partition between continents, regions must require an odd-number majority quorum ($\frac{N}{2} + 1$) or independent witness node before promoting themselves to leader, preventing divergent writes.
   - *The N+1 Evacuation Sizing Law*: In an $N$-region active-active cluster, steady-state CPU utilization per region must never exceed $\frac{N - 1}{N} \times 100\%$ ($50\%$ for 2 regions, $66\%$ for 3 regions). Running above this threshold causes the surviving regions to instantly collapse from CPU starvation when traffic is evacuated.
