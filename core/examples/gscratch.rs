use benchmate_core::gears::*;
fn main() {
    println!("mop {}", mop_spur(1.0, 20.0, 20.0, 0.0, 1.7));
    println!("w2 {}", span_w(1.0, 20.0, 20.0, 0.0, 0.0, 2.0));
    println!("sa {}", spur(1.0, 20.0, 20.0, 0.0, 1.0, 1.25).sa);
    println!("ideal {}", ideal_pin_ext(1.0, 20.0, 20.0, 0.0));
    println!("{:?}", spur_pair(3.0, 12.0, 24.0, 20.0, 0.6, 0.36, 1.0, 1.25));
    println!("{:?}", spur_pair(3.0, 12.0, 24.0, 20.0, 0.0, 0.0, 1.0, 1.25));
    println!("{:?}", helical(3.0, 12.0, 20.0, 30.0, 0.09809, 1.0, 1.25));
    println!("{:?}", helical(3.0, 60.0, 20.0, 30.0, 0.0, 1.0, 1.25));
    println!("{:?}", helical_centre(3.0, 12.0, 60.0, 20.0, 30.0, 0.09809, 0.0));
    println!("k {} w {}", span_k(24.0, 20.0, 0.0, 0.4), span_w(3.0, 24.0, 20.0, 0.0, 0.4, 4.0));
    println!("int pin {} mbp {}", ideal_pin_int(1.0, 40.0, 20.0, 0.0), mbp_internal(1.0, 40.0, 20.0, 0.0, 1.7));
    println!("chordal {:?}", chordal(10.0, 12.0, 20.0, 0.3, 13.0));
}
