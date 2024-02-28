import AccountModel from '@models/Account';
import AssessmentModel, { Assessment } from '@models/Assessment';
import CourseModel from '@models/Course';
import TeamModel, { Team } from '@models/Team';
import TeamSetModel, { TeamSet } from '@models/TeamSet';
import UserModel, { User } from '@models/User';
import Role from '@shared/types/auth/Role';
import { NotFoundError } from './errors';
import { Types } from 'mongoose';

/*----------------------------------------Course----------------------------------------*/
export const createNewCourse = async (courseData: any, accountId: string) => {
  const account = await AccountModel.findById(accountId);
  if (!account) {
    throw new NotFoundError('Account not found');
  }
  const user = await UserModel.findById(account.user);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const course = await CourseModel.create(courseData);
  course.faculty.push(user._id);
  await course.save();
  return course;
};

export const getCoursesForUser = async (accountId: string) => {
  const account = await AccountModel.findById(accountId);
  if (!account) {
    throw new NotFoundError('Account not found');
  }
  const userId = account?.user;
  const courses = await CourseModel.find({
    $or: [{ students: userId }, { TAs: userId }, { faculty: userId }],
  });
  return courses;
};

export const getCourseById = async (courseId: string, accountId: string) => {
  const account = await AccountModel.findById(accountId);
  if (!account) {
    throw new NotFoundError('Account not found');
  }
  AssessmentModel;
  const course = await CourseModel.findById(courseId)
    .populate<{ faculty: User[] }>('faculty')
    .populate<{ TAs: User[] }>('TAs')
    .populate<{ students: User[] }>('students')
    .populate<{ teamSets: TeamSet[] }>({
      path: 'teamSets',
      populate: {
        path: 'teams',
        model: 'Team',
        populate: ['members', 'TA', 'teamData'],
      },
    })
    .populate<{ assessments: Assessment[] }>({
      path: 'assessments',
      populate: {
        path: 'teamSet',
      },
    });
  if (!course) {
    throw new NotFoundError('Course not found');
  }

  const role = account.role;
  if (role === Role.TA) {
    const userId = account.user;
    course.teamSets.forEach(
      teamSet =>
        (teamSet.teams = teamSet.teams.filter(team =>
          (team as unknown as Team).TA?.equals(userId)
        ))
    );
  }

  course.faculty.sort((a, b) => a.name.localeCompare(b.name));
  course.TAs.sort((a, b) => a.name.localeCompare(b.name));
  course.students.sort((a, b) => a.name.localeCompare(b.name));
  course.teamSets.forEach((teamSet: TeamSet) => {
    teamSet.teams.sort(
      (a: unknown, b: unknown) => (a as Team).number - (b as Team).number
    );
  });
  if (Array.isArray(course.milestones)) {
    course.milestones.sort((a, b) => a.number - b.number);
  }
  if (Array.isArray(course.sprints)) {
    course.sprints.sort((a, b) => a.number - b.number);
  }
  return course;
};

export const updateCourseById = async (courseId: string, updateData: any) => {
  const updatedCourse = await CourseModel.findByIdAndUpdate(
    courseId,
    updateData,
    {
      new: true,
    }
  );
  if (!updatedCourse) {
    throw new NotFoundError('Course not found');
  }
};

export const deleteCourseById = async (courseId: string) => {
  const deletedCourse = await CourseModel.findByIdAndDelete(courseId, {
    new: false,
  });
  if (!deletedCourse) {
    throw new NotFoundError('Course not found');
  }
  await TeamModel.deleteMany({ teamSet: { $in: deletedCourse.teamSets } });
  await TeamSetModel.deleteMany({ _id: { $in: deletedCourse.teamSets } });
  await UserModel.updateMany(
    { enrolledCourses: courseId },
    { $pull: { enrolledCourses: courseId } }
  );
};

export const getCourseCodeById = async (courseId: string) => {
  const course = await CourseModel.findById(courseId);
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return course.code;
};

/*----------------------------------------Student----------------------------------------*/
export const addStudentsToCourse = async (
  courseId: string,
  studentDataList: any[]
) => {
  const course = await CourseModel.findById(courseId).populate<{
    students: User[];
  }>('students');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  for (const studentData of studentDataList) {
    const studentId = studentData.identifier;
    let student = await UserModel.findOne({ identifier: studentId });
    if (!student) {
      student = new UserModel({
        identifier: studentId,
        name: studentData.name,
        enrolledCourses: [],
        gitHandle: studentData.gitHandle ?? null,
      });
      await student.save();
      const newAccount = new AccountModel({
        email: studentData.email,
        role: Role.Student,
        isApproved: false,
        user: student._id,
      });
      await newAccount.save();
    } else {
      const studentAccount = await AccountModel.findOne({ user: student._id });
      if (!studentAccount) {
        continue;
      }
      if (
        studentAccount.role !== Role.Student ||
        studentData.name !== student.name ||
        studentData.email !== studentAccount.email
      ) {
        continue;
      }
      student.gitHandle = studentData.gitHandle ?? student.gitHandle;
    }
    if (!student.enrolledCourses.includes(course._id)) {
      student.enrolledCourses.push(course._id);
    }
    await student.save();
    if (!course.students.some(s => s.identifier === student?.identifier)) {
      course.students.push(student);
    }
  }
  await course.save();
};

export const removeStudentsFromCourse = async (
  courseId: string,
  studentId: string
) => {
  const course = await CourseModel.findById(courseId).populate('students');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  const student =
    await UserModel.findById(studentId).populate('enrolledCourses');
  if (!student) {
    throw new NotFoundError('Student not found');
  }

  (course.students as Types.Array<Types.ObjectId>).pull(student._id);
  await course.save();

  (student.enrolledCourses as Types.Array<Types.ObjectId>).pull(course._id);
  await student.save();
};

/*----------------------------------------TA----------------------------------------*/
export const addTAsToCourse = async (courseId: string, TADataList: any[]) => {
  const course = await CourseModel.findById(courseId).populate<{ TAs: User[] }>(
    'TAs'
  );
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  for (const TAData of TADataList) {
    const TAId = TAData.identifier;
    let TA = await UserModel.findOne({ identifier: TAId });
    if (!TA) {
      TA = new UserModel({
        identifier: TAId,
        name: TAData.name,
        enrolledCourses: [],
        gitHandle: TAData.gitHandle ?? null,
      });
      await TA.save();
      const newAccount = new AccountModel({
        email: TAData.email,
        role: Role.TA,
        isApproved: false,
        user: TA._id,
      });
      newAccount.save();
    } else {
      const TAAccount = await AccountModel.findOne({ user: TA._id });
      if (!TAAccount) {
        continue;
      }
      if (
        TAAccount.role !== Role.TA ||
        TAData.name !== TA.name ||
        TAData.email !== TAAccount.email
      ) {
        continue;
      }
      TA.gitHandle = TAData.gitHandle ?? TA.gitHandle;
    }
    if (!TA.enrolledCourses.includes(course._id)) {
      TA.enrolledCourses.push(course._id);
    }
    await TA.save();
    if (!course.TAs.some(ta => ta.identifier === TA?.identifier)) {
      course.TAs.push(TA);
    }
  }
  await course.save();
};

export const getCourseTeachingTeam = async (courseId: string) => {
  const course = await CourseModel.findById(courseId)
    .populate('faculty')
    .populate('TAs');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return [...course.faculty, ...course.TAs];
};

export const removeTAsFromCourse = async (courseId: string, taId: string) => {
  const course = await CourseModel.findById(courseId).populate('TAs');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  const ta = await UserModel.findById(taId).populate('enrolledCourses');
  if (!ta) {
    throw new NotFoundError('TA not found');
  }

  (course.TAs as Types.Array<Types.ObjectId>).pull(ta._id);
  await course.save();

  (ta.enrolledCourses as Types.Array<Types.ObjectId>).pull(course._id);
  await ta.save();
};

/*----------------------------------------Faculty----------------------------------------*/
export const addFacultyToCourse = async (
  courseId: string,
  facultyDataList: any[]
) => {
  const course = await CourseModel.findById(courseId).populate<{
    faculty: User[];
  }>('faculty');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  for (const facultyData of facultyDataList) {
    const facultyId = facultyData.identifier;
    let facultyMember = await UserModel.findOne({ identifier: facultyId });
    if (!facultyMember) {
      facultyMember = new UserModel({
        identifier: facultyId,
        name: facultyData.name,
        enrolledCourses: [],
        gitHandle: facultyData.gitHandle ?? null,
      });
      await facultyMember.save();
      const newAccount = new AccountModel({
        email: facultyData.email,
        role: Role.Faculty,
        isApproved: false,
        user: facultyMember._id,
      });
      newAccount.save();
    } else {
      const facultyAccount = await AccountModel.findOne({
        user: facultyMember._id,
      });
      if (!facultyAccount) {
        continue;
      }
      if (
        facultyAccount.role !== Role.Faculty ||
        facultyData.name !== facultyMember.name ||
        facultyData.email !== facultyAccount.email
      ) {
        continue;
      }
      facultyMember.gitHandle =
        facultyData.gitHandle ?? facultyMember.gitHandle;
    }
    if (!facultyMember.enrolledCourses.includes(course._id)) {
      facultyMember.enrolledCourses.push(course._id);
    }
    await facultyMember.save();
    if (
      !course.faculty.some(
        faculty => faculty.identifier === facultyMember?.identifier
      )
    ) {
      course.faculty.push(facultyMember);
    }
  }
  await course.save();
};

export const removeFacultyFromCourse = async (
  courseId: string,
  facultyId: string
) => {
  const course = await CourseModel.findById(courseId).populate('faculty');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  const facultyMember =
    await UserModel.findById(facultyId).populate('enrolledCourses');
  if (!facultyMember) {
    throw new NotFoundError('Faculty Member not found');
  }

  (course.faculty as Types.Array<Types.ObjectId>).pull(facultyMember._id);
  await course.save();

  (facultyMember.enrolledCourses as Types.Array<Types.ObjectId>).pull(
    course._id
  );
  await facultyMember.save();
};

/*----------------------------------------People----------------------------------------*/
export const getPeopleFromCourse = async (courseId: string) => {
  const course = await CourseModel.findById(courseId)
    .populate('faculty')
    .populate('TAs')
    .populate('students');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return {
    faculty: course.faculty,
    TAs: course.TAs,
    students: course.students,
  };
};

/*----------------------------------------TeamSet----------------------------------------*/
export const getTeamSetsFromCourse = async (courseId: string) => {
  const course = await CourseModel.findById(courseId).populate<{
    teamSets: TeamSet[];
  }>({
    path: 'teamSets',
    populate: {
      path: 'teams',
      model: 'Team',
      populate: ['members', 'TA', 'teamData'],
    },
  });
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return course.teamSets;
};

export const getTeamSetNamesFromCourse = async (courseId: string) => {
  const course = await CourseModel.findById(courseId).populate<{
    teamSets: TeamSet[];
  }>('teamSets');
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return course.teamSets.map((teamSet: TeamSet) => teamSet.name);
};

/*----------------------------------------Milestone----------------------------------------*/
export const addMilestoneToCourse = async (
  courseId: string,
  milestoneData: { number: number; dateline: Date; description: string }
) => {
  const course = await CourseModel.findById(courseId);
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  course.milestones.push(milestoneData);
  await course.save();
};

/*----------------------------------------Sprint----------------------------------------*/
export const addSprintToCourse = async (
  courseId: string,
  sprintData: {
    number: number;
    startDate: Date;
    endDate: Date;
    description: string;
  }
) => {
  const course = await CourseModel.findById(courseId);
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  course.sprints.push(sprintData);
  await course.save();
};

/*----------------------------------------Assessments----------------------------------------*/
export const getAssessmentsFromCourse = async (courseId: string) => {
  const course = await CourseModel.findById(courseId)
  .populate<{
    assessments: Assessment[];
  }>({
    path: 'assessments',
    populate: [
      {
        path: 'teamSet',
        model: 'TeamSet',
      },
    ],
  });
  if (!course) {
    throw new NotFoundError('Course not found');
  }
  return course.assessments;
};
