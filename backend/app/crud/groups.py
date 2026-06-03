import uuid
from sqlalchemy.orm import Session
from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.groups import GroupCreate
from app.crud.notifications import create_notification
from app.schemas.notifications import TypeMassege


def create_group(db: Session, group_data: GroupCreate, creator_id: int):
    reviewer_token = uuid.uuid4().hex
    student_token = uuid.uuid4().hex

    db_group = Group(
        name=group_data.name,
        creator_id=creator_id,
        group_mode=group_data.group_mode,
        count_of_inspectors=group_data.count_of_inspectors,
        reviewer_invite_token=reviewer_token,
        student_invite_token=student_token,
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_group_participants(db: Session, group_id: int):
    creator = (
        db.query(Group, User)
        .join(User, Group.creator_id == User.id)
        .filter(Group.id == group_id)
        .first()
    )

    members = (
        db.query(User.id, User.name, User.surname, GroupMember.role)
        .join(GroupMember, User.id == GroupMember.user_id)
        .filter(GroupMember.group_id == group_id)
        .all()
    )

    result = []
    if creator:
        result.append(
            {
                "user_id": creator.User.id,
                "name": creator.User.name,
                "surname": creator.User.surname,
                "role": "creator",
            }
        )

    for member in members:
        result.append(
            {
                "user_id": member.id,
                "name": member.name,
                "surname": member.surname,
                "role": member.role,
            }
        )

    return result


def remove_member_from_db(db: Session, group_id: int, user_id: int):
    member = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
    )
    group = db.query(Group).filter(Group.id == group_id).first()

    if member:
        create_notification(
            db,
            user_id,
            f"Вас удалили из группы '{group.name}'",
            TypeMassege.REMOVAL_FROM_THE_GROUP,
        )
        db.delete(member)
        db.commit()
        return True

    return False


def get_user_groups(db: Session, user_id: int):
    member_groups = (
        db.query(Group.id, Group.name, Group.group_mode, GroupMember.role)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .filter(GroupMember.user_id == user_id)
        .all()
    )

    owned_groups = (
        db.query(Group.id, Group.name, Group.group_mode)
        .filter(Group.creator_id == user_id)
        .all()
    )

    result = []
    seen_ids = set()

    for group in owned_groups:
        result.append(
            {
                "id": group.id,
                "name": group.name,
                "group_mode": group.group_mode,
                "role": "creator",
            }
        )
        seen_ids.add(group.id)

    for group in member_groups:
        if group.id not in seen_ids:
            result.append(
                {
                    "id": group.id,
                    "name": group.name,
                    "group_mode": group.group_mode,
                    "role": group.role,
                }
            )

    return result
