import type {
  AppData,
  FoodItem,
  Grade,
  Order,
  Payment,
  PointEvent,
  Profile,
  Reward,
  Role,
  ScheduleRow,
  SchoolInfo,
  SubscriptionInfo,
} from './appModel'
import {demoRoleIds} from './appModel'

export const DEMO_FOOD_ITEMS: FoodItem[] = [
  {id: 'burger', name: 'Burger maison', price_xof: 1500, active: true},
  {id: 'sandwich', name: 'Sandwich poulet', price_xof: 1000, active: true},
  {id: 'pizza', name: 'Mini pizza', price_xof: 2000, active: true},
  {id: 'drink', name: 'Boisson', price_xof: 500, active: true},
]

const demoSchool: SchoolInfo = {
  id: 'demo-school',
  name: 'École Démo Horizon',
  city: 'Dakar',
  director_id: demoRoleIds.director,
}

const demoProfiles: Record<Role, Profile> = {
  student: {
    id: demoRoleIds.student,
    full_name: 'Amadou Ndiaye',
    role: 'student',
    class_name: 'Terminale S2',
    email: 'amadou.demo@ecole-os.local',
    school_id: demoSchool.id,
    student_code: 'ELV-2026-0142',
  },
  parent: {
    id: demoRoleIds.parent,
    full_name: 'Fatou Ndiaye',
    role: 'parent',
    child_name: 'Amadou Ndiaye',
    email: 'fatou.demo@ecole-os.local',
    school_id: demoSchool.id,
  },
  teacher: {
    id: demoRoleIds.teacher,
    full_name: 'Moussa Diop',
    role: 'teacher',
    class_name: 'Terminale S1',
    email: 'moussa.demo@ecole-os.local',
    school_id: demoSchool.id,
  },
  admin: {
    id: demoRoleIds.admin,
    full_name: 'Awa Fall',
    role: 'admin',
    email: 'awa.demo@ecole-os.local',
    school_id: demoSchool.id,
  },
  director: {
    id: demoRoleIds.director,
    full_name: 'Mariama Sarr',
    role: 'director',
    email: 'direction.demo@ecole-os.local',
    school_id: demoSchool.id,
  },
  cafeteria: {
    id: demoRoleIds.cafeteria,
    full_name: 'Cheikh Ba',
    role: 'cafeteria',
    email: 'cantine.demo@ecole-os.local',
    school_id: demoSchool.id,
  },
}

const demoGrades: Grade[] = [
  {id: 'demo-grade-maths', subject: 'Mathématiques', value: 16, coefficient: 2, term: 'T1'},
  {id: 'demo-grade-physics', subject: 'Physique', value: 14, coefficient: 2, term: 'T1'},
  {id: 'demo-grade-french', subject: 'Français', value: 15, coefficient: 1, term: 'T1'},
  {id: 'demo-grade-english', subject: 'Anglais', value: 17, coefficient: 1, term: 'T1'},
  {id: 'demo-grade-computing', subject: 'Informatique', value: 18, coefficient: 2, term: 'T1'},
]

// L'emploi du temps couvre les jours ouvrés afin que la démo reste parlante
// quel que soit le jour où elle est ouverte.
const studentSchedule: ScheduleRow[] = [
  {id: 'demo-student-mon-1', weekday: 1, starts_at: '08:00', ends_at: '10:00', subject: 'Mathématiques', room: 'Salle A12', class_name: 'Terminale S2'},
  {id: 'demo-student-mon-2', weekday: 1, starts_at: '10:15', ends_at: '12:00', subject: 'Physique', room: 'Salle B04', class_name: 'Terminale S2'},
  {id: 'demo-student-tue-1', weekday: 2, starts_at: '08:00', ends_at: '10:00', subject: 'Français', room: 'Salle C03', class_name: 'Terminale S2'},
  {id: 'demo-student-tue-2', weekday: 2, starts_at: '10:15', ends_at: '12:00', subject: 'Anglais', room: 'Salle A07', class_name: 'Terminale S2'},
  {id: 'demo-student-wed-1', weekday: 3, starts_at: '09:00', ends_at: '11:00', subject: 'Mathématiques', room: 'Salle A12', class_name: 'Terminale S2'},
  {id: 'demo-student-thu-1', weekday: 4, starts_at: '08:00', ends_at: '10:00', subject: 'Anglais', room: 'Salle A07', class_name: 'Terminale S2'},
  {id: 'demo-student-thu-2', weekday: 4, starts_at: '10:15', ends_at: '12:00', subject: 'Physique', room: 'Salle B04', class_name: 'Terminale S2'},
  {id: 'demo-student-thu-3', weekday: 4, starts_at: '14:00', ends_at: '16:00', subject: 'Informatique', room: 'Lab 2', class_name: 'Terminale S2'},
  {id: 'demo-student-fri-1', weekday: 5, starts_at: '09:00', ends_at: '11:00', subject: 'Français', room: 'Salle C03', class_name: 'Terminale S2'},
  {id: 'demo-student-fri-2', weekday: 5, starts_at: '11:15', ends_at: '13:00', subject: 'Mathématiques', room: 'Salle A12', class_name: 'Terminale S2'},
  {id: 'demo-student-sat-1', weekday: 6, starts_at: '09:00', ends_at: '11:00', subject: 'Sport', room: 'Terrain', class_name: 'Terminale S2'},
]

const teacherSchedule: ScheduleRow[] = [
  {id: 'demo-teacher-mon-1', weekday: 1, starts_at: '08:00', ends_at: '10:00', subject: 'Mathématiques', room: 'Salle A12', class_name: 'Terminale S1'},
  {id: 'demo-teacher-tue-1', weekday: 2, starts_at: '10:15', ends_at: '12:00', subject: 'Algorithmes', room: 'Lab 1', class_name: 'Terminale S1'},
  {id: 'demo-teacher-thu-1', weekday: 4, starts_at: '14:00', ends_at: '16:00', subject: 'Mathématiques', room: 'Salle B04', class_name: 'Terminale S1'},
  {id: 'demo-teacher-fri-1', weekday: 5, starts_at: '09:00', ends_at: '11:00', subject: 'Mathématiques', room: 'Salle A12', class_name: 'Terminale S1'},
]

function shiftedDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timestamp(days: number): string {
  return shiftedDate(days).toISOString()
}

function createPayments(): Payment[] {
  const dueDate = shiftedDate(12)
  return [
    {id: 'demo-payment-current', description: 'Échéance de scolarité', amount_xof: 45000, status: 'pending', due_date: localDate(dueDate)},
    {id: 'demo-payment-paid', description: 'Échéance précédente', amount_xof: 45000, status: 'succeeded', due_date: localDate(shiftedDate(-18))},
  ]
}

function createPoints(): PointEvent[] {
  return [
    {id: 'demo-points-initial', points: 990, reason: 'Solde initial de démonstration', created_at: timestamp(-30)},
    {id: 'demo-points-computing', points: 120, reason: 'Très bonne note en informatique', created_at: timestamp(-20)},
    {id: 'demo-points-attendance', points: 50, reason: 'Présence ponctuelle', created_at: timestamp(-15)},
    {id: 'demo-points-participation', points: 80, reason: 'Participation en classe', created_at: timestamp(-10)},
  ]
}

function createOrders(): Order[] {
  const today = localDate(new Date())
  const previousDay = localDate(shiftedDate(-1))
  return [
    {id: 'demo-order-ready', total_xof: 3000, status: 'ready', pickup_date: today, pickup_slot: '12:30–12:40', created_at: timestamp(-1)},
    {id: 'demo-order-completed', total_xof: 1500, status: 'completed', pickup_date: previousDay, pickup_slot: '12:30–12:40', created_at: timestamp(-2)},
    {id: 'demo-order-preparing', total_xof: 2500, status: 'preparing', pickup_date: today, pickup_slot: '12:15–12:30', created_at: timestamp(-3)},
  ]
}

const demoRewards: Reward[] = [
  {id: 'demo-reward-drink', name: 'Boisson offerte à la cantine', points_cost: 200, active: true},
  {id: 'demo-reward-snack', name: 'Goûter de la semaine', points_cost: 500, active: true, audience_role: 'student'},
  {id: 'demo-reward-book', name: 'Bon d’achat librairie', points_cost: 1000, active: true, audience_role: 'student'},
  {id: 'demo-reward-cafeteria', name: 'Mise en avant du menu', points_cost: 300, active: true, audience_role: 'cafeteria'},
]

const foodRoles: Role[] = ['student', 'parent', 'admin', 'cafeteria']
const studentDataRoles: Role[] = ['student', 'parent', 'teacher', 'admin']
const paymentRoles: Role[] = ['student', 'parent', 'admin']
const orderRoles: Role[] = ['student', 'parent', 'admin', 'cafeteria']

export function createDemoData(role: Role): AppData {
  const profile = {...demoProfiles[role]}
  const orders = createOrders()
  const ownOrders = role === 'student' || role === 'parent'
    ? orders.filter(order => order.id !== 'demo-order-preparing')
    : role === 'admin' || role === 'cafeteria'
      ? orders
      : []
  const subscription: SubscriptionInfo | null = role === 'director'
    ? {id: 'demo-subscription', plan: 'simple', status: 'active', billing_price_xof: 5000, current_period_end: localDate(shiftedDate(30))}
    : null

  return {
    profile,
    studentId: role === 'student' || role === 'parent' ? demoRoleIds.student : null,
    school: {...demoSchool},
    subscription,
    referral: role === 'director' ? {code: 'DEMO-2026'} : null,
    grades: studentDataRoles.includes(role) ? demoGrades.map(grade => ({...grade})) : [],
    schedule: role === 'teacher'
      ? teacherSchedule.map(row => ({...row}))
      : role === 'student' || role === 'parent' || role === 'admin'
        ? studentSchedule.map(row => ({...row}))
        : [],
    payments: paymentRoles.includes(role) ? createPayments() : [],
    points: createPoints(),
    foodItems: foodRoles.includes(role) ? DEMO_FOOD_ITEMS.map(item => ({...item})) : [],
    orders: orderRoles.includes(role) ? ownOrders : [],
    rewards: demoRewards.map(reward => ({...reward})),
    loading: false,
    error: null,
  }
}
