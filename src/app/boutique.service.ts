import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';


export interface StitchingOrderItem {
  itemId?: number;
  garmentType: string;
  fabricDescription?: string;
  quantity: number;
  stitchingCharges: number;
  specialInstructions?: string;
  itemStatus?: string;
  // Generic measurements (all garments)
  chest?: number; waist?: number; hip?: number; shoulder?: number;
  sleeveLength?: number; blouseLength?: number; neckFrontDepth?: number;
  neckBackDepth?: number; neckWidth?: number; kurtaLength?: number;
  salwarLength?: number; fullLength?: number; armhole?: number;
  // Blouse-specific measurements
  upperBust?: number; underBust?: number;
  sleeveRound?: number; bicepRound?: number; elbowRound?: number; wristRound?: number;
  apexPoint?: number; apexToApex?: number; shoulderToApex?: number; shoulderToUnderBust?: number;
  frontLength?: number; backLength?: number; frontWidth?: number; backWidth?: number;
  sideSeamLength?: number; strapWidth?: number; princessLineLength?: number;
  cupSizePadding?: string; bustShapeObservation?: string;
  // Skirt-specific measurements
  highWaistRound?: number; lowWaistRound?: number; seatRound?: number;
  thighRound?: number; kneeRound?: number; calfRound?: number; bottomRound?: number;
  waistToHipLength?: number; waistToKnee?: number; slitHeight?: number;
  canCanRequirement?: string; waistFinish?: string; waistGather?: string;
  // Salwar-specific
  ankleRound?: number; inseamLength?: number; riseLength?: number; crotchDepth?: number;
  // Kurta/Kurti-specific
  collarRound?: number; frontSlitLength?: number; kaliWidth?: number;
  // Lehenga-specific
  numberOfKalis?: string; trailLength?: number;
  // Choli-specific
  underBustBeltLength?: number; backOpeningLength?: number;
  // Anarkali-specific
  waistJointLength?: number; kaliLength?: number;
  // Trouser-specific
  midThighRound?: number; frontRise?: number; backRise?: number; waistbandWidth?: number;
  // Advanced
  boutiqueObservations?: string;
}

export interface BoutiquePayment {
  paymentId?: number;
  paymentDate?: string;
  amount: number;
  paymentMethod: string;
  paymentType: string;
  notes?: string;
}

export interface ExtraCharge {
  chargeId?: number;
  description: string;
  amount: number;
  addedAt?: string;
}

export interface StitchingOrder {
  orderId?: number;
  orderNumber?: string;
  customer?: { customerId: number; customerName?: string; phone?: string };
  orderDate?: string;
  deliveryDate?: string;
  priority: string;
  status?: string;
  totalAmount?: number;
  advancePaid?: number;
  balanceAmount?: number;
  notes?: string;
  createdAt?: string;
  items: StitchingOrderItem[];
  payments?: BoutiquePayment[];
  extraCharges?: ExtraCharge[];
}

export interface BoutiqueOrderImage {
  imageId?: number;
  imageUrl: string;
  publicId?: string;
  createdAt?: string;
}

export interface CustomerMeasurement {
  measurementId?: number;
  customer: { customerId: number; customerName?: string };
  profileName: string;
  // Generic measurements
  chest?: number; waist?: number; hip?: number; shoulder?: number;
  sleeveLength?: number; armhole?: number; blouseLength?: number;
  neckFrontDepth?: number; neckBackDepth?: number; neckWidth?: number;
  kurtaLength?: number; salwarLength?: number; fullLength?: number;
  // Blouse-specific measurements
  upperBust?: number; underBust?: number;
  sleeveRound?: number; bicepRound?: number; elbowRound?: number; wristRound?: number;
  apexPoint?: number; apexToApex?: number; shoulderToApex?: number; shoulderToUnderBust?: number;
  frontLength?: number; backLength?: number; frontWidth?: number; backWidth?: number;
  sideSeamLength?: number; strapWidth?: number; princessLineLength?: number;
  cupSizePadding?: string; bustShapeObservation?: string;
  // Skirt-specific measurements
  highWaistRound?: number; lowWaistRound?: number; seatRound?: number;
  thighRound?: number; kneeRound?: number; calfRound?: number; bottomRound?: number;
  waistToHipLength?: number; waistToKnee?: number; slitHeight?: number;
  canCanRequirement?: string; waistFinish?: string; waistGather?: string;
  // Salwar-specific
  ankleRound?: number; inseamLength?: number; riseLength?: number; crotchDepth?: number;
  // Kurta/Kurti-specific
  collarRound?: number; frontSlitLength?: number; kaliWidth?: number;
  // Lehenga-specific
  numberOfKalis?: string; trailLength?: number;
  // Choli-specific
  underBustBeltLength?: number; backOpeningLength?: number;
  // Anarkali-specific
  waistJointLength?: number; kaliLength?: number;
  // Trouser-specific
  midThighRound?: number; frontRise?: number; backRise?: number; waistbandWidth?: number;
  // Advanced
  boutiqueObservations?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class BoutiqueService {
  private readonly base = '/api/boutique';

  constructor(private http: HttpClient) {}

  getOrders(status = 'ALL', from?: string, to?: string): Observable<StitchingOrder[]> {
    let p = new HttpParams().set('status', status);
    if (from) p = p.set('from', from);
    if (to)   p = p.set('to', to);
    return this.http.get<StitchingOrder[]>(`${this.base}/orders`, { params: p });
  }

  getOrder(id: number): Observable<StitchingOrder> {
    return this.http.get<StitchingOrder>(`${this.base}/orders/${id}`);
  }

  createOrder(order: StitchingOrder): Observable<StitchingOrder> {
    return this.http.post<StitchingOrder>(`${this.base}/orders`, order);
  }

  updateOrder(id: number, order: StitchingOrder): Observable<StitchingOrder> {
    return this.http.put<StitchingOrder>(`${this.base}/orders/${id}`, order);
  }

  updateStatus(id: number, status: string): Observable<StitchingOrder> {
    return this.http.patch<StitchingOrder>(`${this.base}/orders/${id}/status`, { status });
  }

  deleteOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/orders/${id}`);
  }

  addPayment(orderId: number, payment: BoutiquePayment): Observable<StitchingOrder> {
    return this.http.post<StitchingOrder>(`${this.base}/orders/${orderId}/payments`, payment);
  }

  addExtraCharge(orderId: number, charge: ExtraCharge): Observable<StitchingOrder> {
    return this.http.post<StitchingOrder>(`${this.base}/orders/${orderId}/extra-charges`, charge);
  }

  getMeasurements(customerId: number): Observable<CustomerMeasurement[]> {
    return this.http.get<CustomerMeasurement[]>(`${this.base}/measurements?customerId=${customerId}`);
  }

  saveMeasurement(m: CustomerMeasurement): Observable<CustomerMeasurement> {
    return m.measurementId
      ? this.http.put<CustomerMeasurement>(`${this.base}/measurements/${m.measurementId}`, m)
      : this.http.post<CustomerMeasurement>(`${this.base}/measurements`, m);
  }

  deleteMeasurement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/measurements/${id}`);
  }

  getSummary(): Observable<any> {
    return this.http.get<any>(`${this.base}/summary`);
  }

  getItemImages(itemId: number): Observable<BoutiqueOrderImage[]> {
    return this.http.get<BoutiqueOrderImage[]>(`${this.base}/items/${itemId}/images`);
  }

  saveItemImage(itemId: number, imageUrl: string, publicId: string): Observable<BoutiqueOrderImage> {
    return this.http.post<BoutiqueOrderImage>(`${this.base}/items/${itemId}/images`, { imageUrl, publicId });
  }

  deleteItemImage(itemId: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/items/${itemId}/images/${imageId}`);
  }

  uploadToCloudinary(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post('/api/upload/image', formData);
  }

  // ── Boutique Designs ──────────────────────────────────────────────────────

  getDesigns(): Observable<any[]> {
    return this.http.get<any[]>('/api/boutique-designs');
  }

  createDesign(design: any): Observable<any> {
    return this.http.post<any>('/api/boutique-designs', design);
  }

  updateDesign(id: number, design: any): Observable<any> {
    return this.http.put<any>(`/api/boutique-designs/${id}`, design);
  }

  deleteDesign(id: number): Observable<any> {
    return this.http.delete<any>(`/api/boutique-designs/${id}`);
  }

  addDesignImage(designId: number, imageUrl: string, publicId: string): Observable<any> {
    return this.http.post<any>(`/api/boutique-designs/${designId}/images`, { imageUrl, publicId });
  }

  deleteDesignImage(designId: number, imageId: number): Observable<any> {
    return this.http.delete<any>(`/api/boutique-designs/${designId}/images/${imageId}`);
  }
}
