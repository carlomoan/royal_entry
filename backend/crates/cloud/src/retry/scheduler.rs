
pub const RETRY_DELAYS: [u64; 5] = [60, 300, 900, 3600, 21600]; // 1m, 5m, 15m, 1h, 6h

pub fn get_retry_delay(attempt: u32) -> Option<u64> {
    RETRY_DELAYS.get(attempt as usize - 1).copied()
}

pub fn max_retry_attempts() -> u32 {
    RETRY_DELAYS.len() as u32
}

pub fn should_retry(attempt: u32) -> bool {
    attempt < max_retry_attempts()
}
