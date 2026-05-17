import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AnalyticsSnapshotEntity } from './analytics-snapshot.entity';
import { ReservationEntity } from '../reservations/reservation.entity';
import { RoomEntity } from '../rooms/room.entity';
import { GuestEntity } from '../guests/guest.entity';
import { HousekeepingTaskEntity } from '../housekeeping/housekeeping-task.entity';
import { MaintenanceRequestEntity } from '../maintenance/maintenance-request.entity';
import { ConciergeRequestEntity } from '../concierge/concierge-request.entity';
import { FolioItemEntity } from '../folio/folio-item.entity';
import {
  ReservationStatus,
  HousekeepingStatus,
  MaintenanceStatus,
  ConciergeStatus,
  RoomStatus,
} from '../../common/enums';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsSnapshotEntity)
    private readonly snapshotRepo: Repository<AnalyticsSnapshotEntity>,

    @InjectRepository(ReservationEntity)
    private readonly reservationRepo: Repository<ReservationEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepo: Repository<RoomEntity>,

    @InjectRepository(GuestEntity)
    private readonly guestRepo: Repository<GuestEntity>,

    @InjectRepository(HousekeepingTaskEntity)
    private readonly hkRepo: Repository<HousekeepingTaskEntity>,

    @InjectRepository(MaintenanceRequestEntity)
    private readonly maintenanceRepo: Repository<MaintenanceRequestEntity>,

    @InjectRepository(ConciergeRequestEntity)
    private readonly conciergeRepo: Repository<ConciergeRequestEntity>,

    @InjectRepository(FolioItemEntity)
    private readonly folioItemRepo: Repository<FolioItemEntity>,
  ) {}

  // ── Snapshots ────────────────────────────────────────────────────────────────

  async getSnapshots(
    propertyId: string,
    fromDate: string,
    toDate: string,
  ): Promise<AnalyticsSnapshotEntity[]> {
    return this.snapshotRepo.find({
      where: {
        propertyId,
        snapshotDate: Between(fromDate, toDate) as any,
      },
      order: { snapshotDate: 'ASC' },
    });
  }

  async getSnapshot(propertyId: string, date: string): Promise<AnalyticsSnapshotEntity> {
    const snap = await this.snapshotRepo.findOne({ where: { propertyId, snapshotDate: date } });
    if (!snap) throw new NotFoundException(`No snapshot for property ${propertyId} on ${date}`);
    return snap;
  }

  /** Build (or rebuild) the snapshot for a given property + date */
  async buildSnapshot(propertyId: string, date: string): Promise<AnalyticsSnapshotEntity> {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDateStr = nextDay.toISOString().slice(0, 10);

    // ── Rooms ─────────────────────────────────────────────────────────────────
    const totalRooms = await this.roomRepo.count({ where: { propertyId, isActive: true } });
    const occupiedRooms = await this.roomRepo.count({
      where: { propertyId, isActive: true, status: RoomStatus.Occupied },
    });
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // ── Reservations on this date ─────────────────────────────────────────────
    const checkIns = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.propertyId = :propertyId', { propertyId })
      .andWhere('r.checkInDate = :date', { date })
      .andWhere('r.status = :status', { status: ReservationStatus.CheckedIn })
      .getCount();

    const checkOuts = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.propertyId = :propertyId', { propertyId })
      .andWhere('r.checkOutDate = :date', { date })
      .andWhere('r.status = :status', { status: ReservationStatus.CheckedOut })
      .getCount();

    const newReservations = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.propertyId = :propertyId', { propertyId })
      .andWhere('DATE(r.createdAt) = :date', { date })
      .getCount();

    const cancellations = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.propertyId = :propertyId', { propertyId })
      .andWhere('r.status = :status', { status: ReservationStatus.Cancelled })
      .andWhere('DATE(r.cancelledAt) = :date', { date })
      .getCount();

    const noShows = await this.reservationRepo
      .createQueryBuilder('r')
      .where('r.propertyId = :propertyId', { propertyId })
      .andWhere('r.status = :status', { status: ReservationStatus.NoShow })
      .andWhere('r.checkInDate = :date', { date })
      .getCount();

    // ── Revenue from folio items (join through folio to get propertyId) ───────
    const revenueResult = await this.folioItemRepo
      .createQueryBuilder('fi')
      .leftJoin('fi.folio', 'folio')
      .select(
        `SUM(CASE WHEN fi.type IN ('charge','tax') AND fi.isVoided = false THEN fi.amount ELSE 0 END)`,
        'totalCharges',
      )
      .addSelect(
        `SUM(CASE WHEN fi.category = 'room_rate' AND fi.isVoided = false THEN fi.amount ELSE 0 END)`,
        'roomRevenue',
      )
      .where('folio.propertyId = :propertyId', { propertyId })
      .andWhere('DATE(fi.createdAt) = :date', { date })
      .getRawOne();

    const totalRevenue = parseFloat(revenueResult?.totalCharges ?? '0');
    const roomRevenue = parseFloat(revenueResult?.roomRevenue ?? '0');
    const ancillaryRevenue = totalRevenue - roomRevenue;

    const adr = occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0;
    const revpar = totalRooms > 0 ? roomRevenue / totalRooms : 0;

    // ── Operations ────────────────────────────────────────────────────────────
    const housekeepingTasksCompleted = await this.hkRepo
      .createQueryBuilder('hk')
      .where('hk.propertyId = :propertyId', { propertyId })
      .andWhere('DATE(hk.completedAt) = :date', { date })
      .andWhere('hk.status IN (:...statuses)', {
        statuses: [HousekeepingStatus.Clean, HousekeepingStatus.Inspected],
      })
      .getCount();

    const maintenanceRequestsOpen = await this.maintenanceRepo.count({
      where: { propertyId, status: MaintenanceStatus.Open },
    });

    const conciergeRequestsCompleted = await this.conciergeRepo
      .createQueryBuilder('c')
      .where('c.propertyId = :propertyId', { propertyId })
      .andWhere('DATE(c.fulfilledAt) = :date', { date })
      .andWhere('c.status = :status', { status: ConciergeStatus.Completed })
      .getCount();

    // ── Guests ────────────────────────────────────────────────────────────────
    const newGuests = await this.guestRepo
      .createQueryBuilder('g')
      .where('DATE(g.createdAt) = :date', { date })
      .getCount();

    const returningGuests = await this.reservationRepo
      .createQueryBuilder('r')
      .leftJoin('r.guest', 'g')
      .where('r.propertyId = :propertyId', { propertyId })
      .andWhere('r.checkInDate = :date', { date })
      .andWhere('g.totalStays > 1')
      .getCount();

    // ── Upsert snapshot ───────────────────────────────────────────────────────
    const existing = await this.snapshotRepo.findOne({ where: { propertyId, snapshotDate: date } });

    const data = {
      propertyId,
      snapshotDate: date,
      totalRooms,
      occupiedRooms,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      totalRevenue,
      roomRevenue,
      ancillaryRevenue,
      adr: Math.round(adr * 100) / 100,
      revpar: Math.round(revpar * 100) / 100,
      newReservations,
      cancellations,
      checkIns,
      checkOuts,
      noShows,
      housekeepingTasksCompleted,
      maintenanceRequestsOpen,
      conciergeRequestsCompleted,
      newGuests,
      returningGuests,
    };

    if (existing) {
      Object.assign(existing, data);
      return this.snapshotRepo.save(existing);
    }

    return this.snapshotRepo.save(this.snapshotRepo.create(data));
  }

  // ── Live dashboard ────────────────────────────────────────────────────────────

  async getDashboard(propertyId: string): Promise<Record<string, any>> {
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalRooms,
      occupiedRooms,
      availableRooms,
      cleaningRooms,
      maintenanceRooms,
      todayCheckIns,
      todayCheckOuts,
      pendingConfirmed,
      openMaintenance,
      pendingHousekeeping,
    ] = await Promise.all([
      this.roomRepo.count({ where: { propertyId, isActive: true } }),
      this.roomRepo.count({ where: { propertyId, isActive: true, status: RoomStatus.Occupied } }),
      this.roomRepo.count({ where: { propertyId, isActive: true, status: RoomStatus.Available } }),
      this.roomRepo.count({ where: { propertyId, isActive: true, status: RoomStatus.Cleaning } }),
      this.roomRepo.count({ where: { propertyId, isActive: true, status: RoomStatus.Maintenance } }),
      this.reservationRepo.count({
        where: { propertyId, checkInDate: today, status: ReservationStatus.Confirmed },
      }),
      this.reservationRepo.count({
        where: { propertyId, checkOutDate: today, status: ReservationStatus.CheckedIn },
      }),
      this.reservationRepo.count({
        where: { propertyId, status: ReservationStatus.Confirmed },
      }),
      this.maintenanceRepo.count({ where: { propertyId, status: MaintenanceStatus.Open } }),
      this.hkRepo.count({
        where: { propertyId, scheduledDate: today, status: HousekeepingStatus.Dirty },
      }),
    ]);

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 10000) / 100 : 0;

    return {
      date: today,
      propertyId,
      rooms: { totalRooms, occupiedRooms, availableRooms, cleaningRooms, maintenanceRooms, occupancyRate },
      today: { checkIns: todayCheckIns, checkOuts: todayCheckOuts },
      reservations: { pendingConfirmed },
      operations: { openMaintenance, pendingHousekeeping },
    };
  }

  async getOccupancyTrend(
    propertyId: string,
    fromDate: string,
    toDate: string,
  ): Promise<{ date: string; occupancyRate: number; adr: number; revpar: number }[]> {
    const snaps = await this.getSnapshots(propertyId, fromDate, toDate);
    return snaps.map((s) => ({
      date: s.snapshotDate,
      occupancyRate: Number(s.occupancyRate),
      adr: Number(s.adr),
      revpar: Number(s.revpar),
    }));
  }

  async getRevenueSummary(
    propertyId: string,
    fromDate: string,
    toDate: string,
  ): Promise<{
    totalRevenue: number;
    roomRevenue: number;
    ancillaryRevenue: number;
    avgDailyRevenue: number;
  }> {
    const snaps = await this.getSnapshots(propertyId, fromDate, toDate);
    const totalRevenue = snaps.reduce((sum, s) => sum + Number(s.totalRevenue), 0);
    const roomRevenue = snaps.reduce((sum, s) => sum + Number(s.roomRevenue), 0);
    const ancillaryRevenue = snaps.reduce((sum, s) => sum + Number(s.ancillaryRevenue), 0);
    const avgDailyRevenue = snaps.length > 0 ? totalRevenue / snaps.length : 0;
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      roomRevenue: Math.round(roomRevenue * 100) / 100,
      ancillaryRevenue: Math.round(ancillaryRevenue * 100) / 100,
      avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
    };
  }
}
