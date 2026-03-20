export class BinaryWriter {
  private buffer = new ArrayBuffer(256);
  private view = new DataView(this.buffer);
  private offset = 0;

  private ensure(size: number): void {
    if (this.offset + size <= this.buffer.byteLength) return;
    let nextSize = this.buffer.byteLength;
    while (this.offset + size > nextSize) {
      nextSize *= 2;
    }
    const next = new ArrayBuffer(nextSize);
    new Uint8Array(next).set(new Uint8Array(this.buffer));
    this.buffer = next;
    this.view = new DataView(this.buffer);
  }

  u8(value: number): void {
    this.ensure(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  i8(value: number): void {
    this.ensure(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  u16(value: number): void {
    this.ensure(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  i16(value: number): void {
    this.ensure(2);
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }

  u32(value: number): void {
    this.ensure(4);
    this.view.setUint32(this.offset, value >>> 0, true);
    this.offset += 4;
  }

  string(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.u16(encoded.length);
    this.ensure(encoded.length);
    new Uint8Array(this.buffer, this.offset, encoded.length).set(encoded);
    this.offset += encoded.length;
  }

  bytes(value: Uint8Array): void {
    this.u16(value.length);
    this.ensure(value.length);
    new Uint8Array(this.buffer, this.offset, value.length).set(value);
    this.offset += value.length;
  }

  finish(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }
}
