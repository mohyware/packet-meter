## Overview

We can get total usage stats by reading the kernel-exposed RX and TX byte counters from ``(/sys/class/net/<interface>/statistics/{rx_bytes,tx_bytes})``. However, I am still exploring how to get per-process usage similar to other services.

